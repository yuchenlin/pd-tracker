#!/usr/bin/env node
/**
 * Backfill historical Visa Bulletin months from cached DOS HTML mirrors.
 * Prefer official pages when available; this run uses local saved HTML copies
 * mirrored from travel.state.gov (vyakunin/visa_bulletin saved_pages).
 *
 * Usage:
 *   node scripts/backfill-bulletins.mjs --from 2021-09 --to 2023-09
 *   node scripts/backfill-bulletins.mjs --from 2021-09 --to 2023-09 --cache-dir /path/to/saved_pages
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bulletinUrl, parseBulletinHtml } from "./lib/parse-bulletin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "src/data/visa-bulletins.json");

const MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];

function parseArgs(argv) {
  const out = {
    from: "2021-09",
    to: "2023-09",
    cacheDir:
      process.env.VB_CACHE_DIR ||
      "/workspace/visa_bulletin_cache/data/bulletin/saved_pages",
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--to") out.to = argv[++i];
    else if (a === "--cache-dir") out.cacheDir = argv[++i];
  }
  return out;
}

function* monthRange(fromId, toId) {
  let [y, m] = fromId.split("-").map(Number);
  const [ty, tm] = toId.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    yield { year: y, month: m, id: `${y}-${String(m).padStart(2, "0")}` };
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

function cachePath(cacheDir, year, month) {
  const name = MONTH_NAMES[month - 1];
  return join(cacheDir, `visa-bulletin-for-${name}-${year}.html`);
}

function validateBulletin(b) {
  const problems = [];
  for (const table of ["A", "B"]) {
    for (const cat of ["EB-1", "EB-2", "EB-3"]) {
      const row = b.tables[table][cat];
      if (!row) problems.push(`missing ${table} ${cat}`);
    }
  }
  // At least one non-null date somewhere in EB-2/EB-3 China or India across A/B
  const samples = [
    b.tables.A["EB-2"].CHINA,
    b.tables.A["EB-2"].INDIA,
    b.tables.B["EB-2"].CHINA,
    b.tables.A["EB-3"].CHINA,
  ];
  if (samples.every((v) => v == null)) {
    // Could be legitimate if everything Current — rare for China EB-2 historically
    problems.push("suspicious: EB-2/EB-3 China+India all Current on A/B");
  }
  return problems;
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(DATA_PATH)) throw new Error(`Missing ${DATA_PATH}`);
  if (!existsSync(args.cacheDir)) throw new Error(`Missing cache dir ${args.cacheDir}`);

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const results = { added: [], updated: [], failed: [], skipped: [] };

  for (const { year, month, id } of monthRange(args.from, args.to)) {
    const file = cachePath(args.cacheDir, year, month);
    if (!existsSync(file)) {
      results.failed.push({ id, reason: `missing cache file ${file}` });
      console.warn(`FAIL ${id}: no cache file`);
      continue;
    }
    try {
      const html = readFileSync(file, "utf8");
      const sourceUrl = bulletinUrl(year, month);
      const bulletin = parseBulletinHtml(html, { year, month, id, sourceUrl });
      const problems = validateBulletin(bulletin);
      if (problems.length) {
        results.failed.push({ id, reason: problems.join("; ") });
        console.warn(`FAIL ${id}: ${problems.join("; ")}`);
        continue;
      }
      const idx = data.bulletins.findIndex((b) => b.id === id);
      if (idx >= 0) {
        // Preserve uscisAosChart from existing seed when refreshing
        const prev = data.bulletins[idx];
        data.bulletins[idx] = {
          ...bulletin,
          uscisAosChart: prev.uscisAosChart ?? bulletin.uscisAosChart,
        };
        results.updated.push(id);
        console.log(`updated ${id}; EB-2 CHINA A=${bulletin.tables.A["EB-2"].CHINA}`);
      } else {
        data.bulletins.push(bulletin);
        results.added.push(id);
        console.log(`added ${id}; EB-2 CHINA A=${bulletin.tables.A["EB-2"].CHINA}`);
      }
    } catch (e) {
      results.failed.push({ id, reason: e.message });
      console.warn(`FAIL ${id}: ${e.message}`);
    }
  }

  data.bulletins.sort((a, b) => a.id.localeCompare(b.id));
  data.updatedAt = new Date().toISOString().slice(0, 10);
  data.schemaVersion = Math.max(data.schemaVersion ?? 1, 2);
  data.notes = {
    ...(data.notes && typeof data.notes === "object" ? data.notes : {}),
    backfill: {
      from: args.from,
      to: args.to,
      source:
        "Parsed from DOS Visa Bulletin HTML mirrors (travel.state.gov pages cached under vyakunin/visa_bulletin saved_pages). Official URLs recorded in each bulletin.sourceUrl. Live travel.state.gov fetch was Cloudflare-blocked and Internet Archive was temporarily offline during this backfill.",
      added: results.added,
      updated: results.updated,
      failed: results.failed,
    },
  };

  console.log(
    JSON.stringify(
      {
        added: results.added.length,
        updated: results.updated.length,
        failed: results.failed.length,
        totalBulletins: data.bulletins.length,
        first: data.bulletins[0]?.id,
        last: data.bulletins.at(-1)?.id,
        failedDetail: results.failed,
      },
      null,
      2,
    ),
  );

  if (args.dryRun) {
    console.log("Dry run — not writing");
    return;
  }
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${DATA_PATH}`);
}

main();
