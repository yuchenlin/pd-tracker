#!/usr/bin/env node
/**
 * Fetch the latest (or specified) DOS Visa Bulletin HTML, parse employment
 * Table A / Table B, optionally scrape USCIS AOS chart selection, and merge
 * into src/data/visa-bulletins.json.
 *
 * travel.state.gov is often behind Cloudflare for non-browser clients, so we:
 *   1) try the live URL
 *   2) fall back to the newest Internet Archive CDX capture
 *   3) accept --html / --pdf-path style local files via --file
 *
 * Usage:
 *   node scripts/scrape-visa-bulletin.mjs                 # auto next/latest month
 *   node scripts/scrape-visa-bulletin.mjs --id 2026-09
 *   node scripts/scrape-visa-bulletin.mjs --file ./bulletin.html --id 2026-09
 *   node scripts/scrape-visa-bulletin.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bulletinUrl,
  isCloudflareInterstitial,
  parseBulletinHtml,
  parseUscisAosChart,
} from "./lib/parse-bulletin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "src/data/visa-bulletins.json");
const USCIS_URL =
  "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin";

const UA =
  "PD-Tracker/1.0 (+https://github.com/yuchenlin/pd-tracker; educational mirror)";

function parseArgs(argv) {
  const out = { id: null, file: null, dryRun: false, skipUscis: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--skip-uscis") out.skipUscis = true;
    else if (a === "--id") out.id = argv[++i];
    else if (a === "--file") out.file = argv[++i];
    else if (a.startsWith("--id=")) out.id = a.slice(5);
    else if (a.startsWith("--file=")) out.file = a.slice(7);
  }
  return out;
}

function monthIdFromDate(d = new Date()) {
  // Bulletins are labeled for the upcoming month and usually publish mid-prior-month.
  // Cron runs mid-month: try current calendar month first, then next month.
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function nextMonthId(id) {
  let [y, m] = id.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, url: res.url };
}

async function fetchViaWayback(liveUrl) {
  const cdx =
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(liveUrl)}` +
    `&output=json&filter=statuscode:200&filter=mimetype:text/html&fl=timestamp,original&limit=5&fastLatest=true`;
  const { ok, text } = await fetchText(cdx);
  if (!ok) throw new Error(`CDX lookup failed for ${liveUrl}`);
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    throw new Error("CDX response was not JSON");
  }
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error("No Wayback captures found");
  }
  // rows[0] is header; pick newest timestamp
  const body = rows.slice(1).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  const ts = body[0][0];
  const archived = `https://web.archive.org/web/${ts}id_/${liveUrl}`;
  const page = await fetchText(archived);
  if (!page.ok) throw new Error(`Wayback fetch failed ${page.status}`);
  if (isCloudflareInterstitial(page.text)) {
    throw new Error("Wayback returned Cloudflare interstitial");
  }
  return { html: page.text, sourceUrl: liveUrl, via: archived };
}

async function fetchBulletinHtml(year, month) {
  const live = bulletinUrl(year, month);
  try {
    const page = await fetchText(live);
    if (page.ok && !isCloudflareInterstitial(page.text) && /FINAL ACTION DATES FOR EMPLOYMENT/i.test(page.text)) {
      return { html: page.text, sourceUrl: live, via: "live" };
    }
    console.warn(`Live fetch unusable (status=${page.status}); trying Wayback…`);
  } catch (e) {
    console.warn(`Live fetch error: ${e.message}; trying Wayback…`);
  }
  return fetchViaWayback(live);
}

async function fetchUscisEmploymentChart() {
  const page = await fetchText(USCIS_URL);
  if (!page.ok) {
    console.warn(`USCIS page fetch failed: ${page.status}`);
    return null;
  }
  const parsed = parseUscisAosChart(page.text);
  return parsed.employment; // "A" | "B" | null
}

function loadData() {
  return JSON.parse(readFileSync(DATA_PATH, "utf8"));
}

function upsertBulletin(data, bulletin) {
  const idx = data.bulletins.findIndex((b) => b.id === bulletin.id);
  if (idx >= 0) data.bulletins[idx] = { ...data.bulletins[idx], ...bulletin };
  else data.bulletins.push(bulletin);
  data.bulletins.sort((a, b) => a.id.localeCompare(b.id));
  data.updatedAt = new Date().toISOString().slice(0, 10);
  data.schemaVersion = Math.max(data.schemaVersion ?? 1, 2);
  return idx < 0 ? "added" : "updated";
}

async function resolveTargetId(args, data) {
  if (args.id) return args.id;
  const latest = data.bulletins.map((b) => b.id).sort().at(-1);
  const candidates = [monthIdFromDate(), nextMonthId(monthIdFromDate())];
  if (latest) candidates.push(nextMonthId(latest));
  // Prefer the newest candidate not yet in the dataset
  const unique = [...new Set(candidates)].sort();
  for (const id of unique.reverse()) {
    if (!data.bulletins.some((b) => b.id === id)) return id;
  }
  // Otherwise refresh the latest known id
  return latest ?? monthIdFromDate();
}

async function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(DATA_PATH)) {
    throw new Error(`Missing data file at ${DATA_PATH}`);
  }
  const data = loadData();
  const id = await resolveTargetId(args, data);
  const [year, month] = id.split("-").map(Number);
  console.log(`Target bulletin: ${id}`);

  let html;
  let sourceUrl = bulletinUrl(year, month);
  let via = "file";

  if (args.file) {
    html = readFileSync(args.file, "utf8");
  } else {
    const fetched = await fetchBulletinHtml(year, month);
    html = fetched.html;
    sourceUrl = fetched.sourceUrl;
    via = fetched.via;
    console.log(`Fetched via: ${via}`);
  }

  const bulletin = parseBulletinHtml(html, { year, month, id, sourceUrl });

  if (!args.skipUscis) {
    try {
      const chart = await fetchUscisEmploymentChart();
      if (chart) {
        bulletin.uscisAosChart = chart;
        console.log(`USCIS AOS employment chart: Table ${chart}`);
      } else {
        console.log("USCIS AOS employment chart: unknown (left null)");
      }
    } catch (e) {
      console.warn(`USCIS scrape skipped: ${e.message}`);
    }
  }

  const action = upsertBulletin(data, bulletin);
  console.log(`${action} ${bulletin.id}; EB-2 CHINA A=${bulletin.tables.A["EB-2"].CHINA}`);

  if (args.dryRun) {
    console.log(JSON.stringify(bulletin, null, 2));
    console.log("Dry run — data file not written.");
    return;
  }

  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${DATA_PATH}`);
  // Emit machine-readable summary for CI
  writeFileSync(
    join(ROOT, "scrape-result.json"),
    JSON.stringify({ action, id: bulletin.id, via, uscisAosChart: bulletin.uscisAosChart ?? null }, null, 2) + "\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
