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
  // DOS nests bulletins under the federal fiscal year folder (Oct → Sep).
  // e.g. October 2023 lives under /visa-bulletin/2024/visa-bulletin-for-october-2023.html
  const folderYear = month >= 10 ? year + 1 : year;
  return `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${folderYear}/visa-bulletin-for-${name}-${year}.html`;
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

function mapChargeabilityHeaders(headerCells) {
  /** Map chargeability keys to column indices from a header row. */
  const map = {};
  headerCells.forEach((raw, i) => {
    if (i === 0) return;
    const t = String(raw).replace(/\s+/g, " ").toUpperCase();
    if (/ALL CHARGEABILITY|EXCEPT THOSE LISTED|WORLDWIDE|ALL AREAS/i.test(t) && !/CHINA|INDIA|MEXICO|PHILIPPINES|SALVADOR/i.test(t)) {
      map.ROW = i;
    } else if (/CHINA/.test(t)) {
      map.CHINA = i;
    } else if (/INDIA/.test(t)) {
      map.INDIA = i;
    } else if (/MEXICO/.test(t)) {
      map.MEXICO = i;
    } else if (/PHILIPPINES/.test(t)) {
      map.PHILIPPINES = i;
    }
    // EL SALVADOR / GUATEMALA / HONDURAS column intentionally ignored
  });
  return map;
}

function defaultChargeabilityMap(cellCount) {
  // Modern 6-column layout: cat + ROW/CHINA/INDIA/MEXICO/PHILIPPINES
  if (cellCount >= 6) {
    return { ROW: 1, CHINA: 2, INDIA: 3, MEXICO: 4, PHILIPPINES: 5 };
  }
  return { ROW: 1, CHINA: 2, INDIA: 3, MEXICO: 4, PHILIPPINES: 5 };
}

function parseEmploymentTable(tableHtml) {
  const out = emptyTable();
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => r[1]);
  let colMap = null;
  for (const rowHtml of rows) {
    const cells = [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
      stripTags(c[1]),
    );
    if (cells.length < 5) continue;
    const label = cells[0];

    // Header row: establish column map (handles optional ESH column)
    if (/employment/i.test(label) || /chargeability|china|india/i.test(cells.slice(1).join(" "))) {
      const mapped = mapChargeabilityHeaders(cells);
      if (mapped.ROW != null && mapped.CHINA != null && mapped.INDIA != null) {
        colMap = mapped;
      }
      continue;
    }

    let cat = null;
    for (const rule of ROW_TO_CAT) {
      if (rule.re.test(label)) {
        cat = rule.cat;
        break;
      }
    }
    if (!cat) continue;
    // Skip "Other Workers" and EB-5 set-asides / religious workers
    if (/other\s*workers/i.test(label)) continue;
    if (/set\s*aside/i.test(label)) continue;
    if (/religious/i.test(label)) continue;
    // Prefer Non-Regional / Unreserved EB-5; skip Regional Center rows
    if (/^5th/i.test(label) && /regional\s*center/i.test(label) && !/non[-\s]?regional/i.test(label)) {
      continue;
    }

    const map = colMap ?? defaultChargeabilityMap(cells.length);
    const pick = (key) => {
      const idx = map[key];
      if (idx == null || idx >= cells.length) return null;
      return parseCutoffCell(cells[idx]);
    };
    out[cat] = {
      ROW: pick("ROW"),
      CHINA: pick("CHINA"),
      INDIA: pick("INDIA"),
      MEXICO: pick("MEXICO"),
      PHILIPPINES: pick("PHILIPPINES"),
    };
  }
  return out;
}

function isEmploymentPrefTable(tableHtml) {
  // Must look like EB preference chart: "1st" row + China/India headers
  return /\b1st\b/i.test(tableHtml) && /CHINA/i.test(tableHtml) && /INDIA/i.test(tableHtml);
}

function findSectionTables(html) {
  const upper = html.toUpperCase();
  // Prefer specific EMPLOYMENT-BASED heading; avoid prose false positives.
  let aIdx = upper.search(/FINAL ACTION DATES FOR EMPLOYMENT-BASED/);
  if (aIdx < 0) aIdx = upper.search(/A\.\s*FINAL ACTION DATES FOR EMPLOYMENT/);
  let bIdx = upper.search(/DATES FOR FILING OF EMPLOYMENT-BASED/);
  if (bIdx < 0) bIdx = upper.search(/B\.\s*DATES FOR FILING OF EMPLOYMENT/);
  const tables = extractTables(html);
  const empTables = tables.filter(isEmploymentPrefTable);

  function tableAfter(idx) {
    if (idx < 0) return null;
    let best = null;
    let bestPos = Infinity;
    for (const t of empTables) {
      const pos = html.indexOf(t);
      if (pos > idx && pos < bestPos) {
        best = t;
        bestPos = pos;
      }
    }
    return best;
  }

  let aTable = tableAfter(aIdx);
  let bTable = tableAfter(bIdx);

  // Fallback: first two employment preference tables in document order (A then B)
  if (!aTable || !bTable || aTable === bTable) {
    if (empTables.length >= 2) {
      aTable = empTables[0];
      bTable = empTables[1];
    }
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
