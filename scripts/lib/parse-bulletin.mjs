/**
 * Parse DOS Visa Bulletin HTML for employment-based Table A (Final Action)
 * and Table B (Dates for Filing).
 *
 * Cut-off cells: C → null, U → "U", DDMMMYY → YYYY-MM-DD.
 */

const MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];
const MONTH_ABBR = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const ROW_TO_CAT = [
  { re: /^1st/i, cat: "EB-1" },
  { re: /^2nd/i, cat: "EB-2" },
  { re: /^3rd(?!\s*Other)/i, cat: "EB-3" },
  { re: /^4th/i, cat: "EB-4" },
  { re: /^5th\s*Unreserved/i, cat: "EB-5" },
  { re: /^5th(?!\s*Set)/i, cat: "EB-5" },
];

export function bulletinUrl(year, month) {
  const name = MONTH_NAMES[month - 1];
  return `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${year}/visa-bulletin-for-${name}-${year}.html`;
}

export function parseCutoffCell(raw) {
  const t = String(raw ?? "").replace(/\u00a0/g, " ").trim().toUpperCase();
  if (!t) return null;
  if (t === "C" || t === "CURRENT") return null;
  if (t === "U" || t === "UNAVAILABLE") return "U";
  // DDMMMYY e.g. 08NOV22 or 15MAY23
  const m = t.replace(/\s+/g, "").match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTH_ABBR[m[2]];
    let year = Number(m[3]);
    year += year >= 70 ? 1900 : 2000;
    if (!mon || day < 1 || day > 31) return "U";
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return "U";
}

function emptyTable() {
  const cats = ["EB-1", "EB-2", "EB-3", "EB-4", "EB-5"];
  const chs = ["ROW", "CHINA", "INDIA", "MEXICO", "PHILIPPINES"];
  return Object.fromEntries(cats.map((c) => [c, Object.fromEntries(chs.map((ch) => [ch, null]))]));
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(td|th|tr|p|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTables(html) {
  const tables = [];
  const re = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = re.exec(html))) {
    tables.push(m[0]);
  }
  return tables;
}

function parseEmploymentTable(tableHtml) {
  const out = emptyTable();
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => r[1]);
  for (const rowHtml of rows) {
    const cells = [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
      stripTags(c[1]),
    );
    if (cells.length < 6) continue;
    const label = cells[0];
    let cat = null;
    for (const rule of ROW_TO_CAT) {
      if (rule.re.test(label)) {
        cat = rule.cat;
        break;
      }
    }
    if (!cat) continue;
    // Skip "Other Workers" and EB-5 set-asides
    if (/other\s*workers/i.test(label)) continue;
    if (/set\s*aside/i.test(label)) continue;
    if (/religious/i.test(label)) continue;
    const vals = cells.slice(1, 6).map(parseCutoffCell);
    out[cat] = {
      ROW: vals[0],
      CHINA: vals[1],
      INDIA: vals[2],
      MEXICO: vals[3],
      PHILIPPINES: vals[4],
    };
  }
  return out;
}

function findSectionTables(html) {
  const upper = html.toUpperCase();
  const aIdx = upper.search(/FINAL ACTION DATES FOR EMPLOYMENT/);
  const bIdx = upper.search(/DATES FOR FILING OF EMPLOYMENT/);
  const tables = extractTables(html);

  function tableAfter(idx) {
    if (idx < 0) return null;
    let best = null;
    let bestPos = Infinity;
    for (const t of tables) {
      const pos = html.indexOf(t);
      if (pos > idx && pos < bestPos) {
        best = t;
        bestPos = pos;
      }
    }
    return best;
  }

  // Prefer first employment table after each heading
  let aTable = tableAfter(aIdx);
  let bTable = tableAfter(bIdx);

  // Fallback: first two employment-looking tables
  if (!aTable || !bTable) {
    const empTables = tables.filter((t) => /1st|2nd|CHINA|PHILIPPINES/i.test(t));
    if (!aTable && empTables[0]) aTable = empTables[0];
    if (!bTable && empTables[1]) bTable = empTables[1];
  }

  return { aTable, bTable };
}

export function isCloudflareInterstitial(html) {
  return /Just a moment|cf-challenge|challenge-platform/i.test(html) && html.length < 20000;
}

export function parseBulletinHtml(html, { year, month, id, sourceUrl } = {}) {
  if (isCloudflareInterstitial(html)) {
    throw new Error("Received Cloudflare interstitial instead of Visa Bulletin HTML");
  }
  const { aTable, bTable } = findSectionTables(html);
  if (!aTable || !bTable) {
    throw new Error("Could not locate employment Table A and/or Table B in HTML");
  }
  const A = parseEmploymentTable(aTable);
  const B = parseEmploymentTable(bTable);

  // Basic validation: at least EB-1/EB-2 present
  if (!A["EB-1"] || !A["EB-2"] || !B["EB-1"] || !B["EB-2"]) {
    throw new Error("Parsed tables missing required EB-1/EB-2 rows");
  }

  const y = year ?? Number(String(id).slice(0, 4));
  const m = month ?? Number(String(id).slice(5, 7));
  const titleMatch = html.match(/Visa Bulletin For\s+([A-Za-z]+)\s+(\d{4})/i);
  const title = titleMatch
    ? `Visa Bulletin For ${titleMatch[1]} ${titleMatch[2]}`
    : `Visa Bulletin For ${MONTH_NAMES[m - 1][0].toUpperCase()}${MONTH_NAMES[m - 1].slice(1)} ${y}`;

  return {
    id: id ?? `${y}-${String(m).padStart(2, "0")}`,
    year: y,
    month: m,
    published: `${y}-${String(m).padStart(2, "0")}-01`,
    title,
    sourceUrl: sourceUrl ?? bulletinUrl(y, m),
    uscisAosChart: null,
    tables: { A, B },
  };
}

export function parseUscisAosChart(html) {
  /**
   * Returns { family: "A"|"B"|null, employment: "A"|"B"|null }
   * from the USCIS Adjustment of Status Filing Charts page.
   */
  const text = stripTags(html);
  const result = { family: null, employment: null };

  const emp = text.match(
    /For Employment-Based Preference Filings:[\s\S]{0,400}?use the\s+(Final Action Dates|Dates for Filing)\s+chart/i,
  );
  if (emp) {
    result.employment = /Final Action/i.test(emp[1]) ? "A" : "B";
  }

  const fam = text.match(
    /For Family-Sponsored Filings:[\s\S]{0,400}?use the\s+(Final Action Dates|Dates for Filing)\s+chart/i,
  );
  if (fam) {
    result.family = /Final Action/i.test(fam[1]) ? "A" : "B";
  }

  return result;
}
