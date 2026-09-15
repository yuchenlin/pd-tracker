# PD Tracker

Free interactive historical charts and a priority-date checker for U.S. Department of State **Visa Bulletin** employment-based cut-off dates.

> **Disclaimer:** This is an **unofficial** educational project. It is **not affiliated** with the Department of State or USCIS, is **not legal advice**, and may lag or mis-parse a bulletin. **Always verify** against the official Visa Bulletin at [travel.state.gov](https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html) and USCIS guidance before acting on a case.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build    # production build
npm run start    # serve the production build
npm run scrape:bulletin   # fetch/parse latest bulletin into JSON (see below)
```

## What you get

- **Charts** (`/`) — Recharts line chart of monthly cut-off dates with **Table A** (Final Action) and **Table B** (Dates for Filing), plus a solid **Your PD** reference and optional **Include PD in scale**. Optional **Compare China & India** overlays both countries. Filter by EB-1…EB-5 and chargeability; ranges 2y / 1y / 6m / All.
- **PD Checker** (`/` and `/checker`) — Demo case pre-filled: **EB-1, China (mainland), PD 2024-07-16** (not paywalled). Shows whether that PD is current for Table A and Table B.
- **JSON API** — CORS-enabled (`Access-Control-Allow-Origin: *`) for a future iOS client.

Defaults: **EB-1**, **China (mainland)**, **PD 2024-07-16**, chart range **2 years** (both Table A and Table B plotted).

## Data schema

Seed file: [`src/data/visa-bulletins.json`](src/data/visa-bulletins.json)

Historical months are curated from **official DOS Visa Bulletin** employment tables (U.S. government works; public domain). Seed coverage is **September 2021 → August 2026** (60 monthly snapshots, ~5 years). Earlier months were backfilled from DOS HTML mirrors via `scripts/backfill-bulletins.mjs` (parser handles optional El Salvador/Guatemala/Honduras columns). Ongoing months are meant to be ingested by the scraper / GitHub Action — not hand-edited.

### Cut-off values

| JSON value | Meaning on the bulletin |
| --- | --- |
| `null` | **C (Current)** — category is current |
| `"U"` | **Unavailable** — visa numbers unavailable for the period |
| `"YYYY-MM-DD"` | Cut-off date (ISO) |

Charts plot `null` (C) at the **bulletin month end** and **omit** `U` points so unavailable months leave a gap (`connectNulls={false}`).

### Table A / Table B vs USCIS AOS chart

These are **separate** concepts in the schema:

| Field | Meaning |
| --- | --- |
| `tables.A` | DOS **Final Action Dates** historical series |
| `tables.B` | DOS **Dates for Filing** historical series |
| `uscisAosChart` | Optional USCIS flag for which chart **adjustment-of-status** filers should use **that month** (`"A"`, `"B"`, or `null` if unknown). Scraped from the [USCIS AOS filing charts page](https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin). |

Do not collapse USCIS chart selection into the historical A/B series.

### Shape

```json
{
  "schemaVersion": 2,
  "source": "…",
  "updatedAt": "2026-09-15",
  "bulletins": [
    {
      "id": "2024-07",
      "year": 2024,
      "month": 7,
      "published": "2024-06-11",
      "title": "Visa Bulletin For July 2024",
      "sourceUrl": "https://travel.state.gov/…/visa-bulletin-for-july-2024.html",
      "uscisAosChart": null,
      "tables": {
        "A": {
          "EB-1": { "ROW": null, "CHINA": "2022-11-01", "INDIA": "2022-02-01", "MEXICO": null, "PHILIPPINES": null },
          "EB-2": { "ROW": "2023-03-15", "CHINA": "2020-03-01", "INDIA": "2012-06-15", "MEXICO": "2023-03-15", "PHILIPPINES": "2023-03-15" },
          "EB-3": {},
          "EB-4": {},
          "EB-5": {}
        },
        "B": {}
      }
    }
  ]
}
```

### Keys

- **Categories:** `EB-1` … `EB-5` (hyphenated; `EB2` accepted in query params)
- **Chargeabilities:** `CHINA`, `INDIA`, `MEXICO`, `PHILIPPINES`, `ROW`
- **Tables:** `A` = Final Action, `B` = Dates for Filing

## Public API

| Route | Description |
| --- | --- |
| `GET /api/bulletins` | List bulletin summaries (includes `uscisAosChart` when set) |
| `GET /api/bulletins/[id]` | Full bulletin (`2024-07`) |
| `GET /api/series?table=A,B&category=EB-2&chargeability=CHINA` | Time series for charts (`table=A`, `B`, `A,B`, or `both`; comma-separated chargeabilities OK) |
| `GET /api/check?table=A&category=EB-2&chargeability=CHINA&pd=2024-07-16` | PD current / not-current / unavailable |

## Monthly updates (GitHub Action)

Workflow template: [`docs/github-workflows/update-visa-bulletin.yml`](docs/github-workflows/update-visa-bulletin.yml)

To enable automated PRs, copy it into `.github/workflows/` (requires a token/`gh` auth with the `workflow` scope the first time):

```bash
mkdir -p .github/workflows
cp docs/github-workflows/update-visa-bulletin.yml .github/workflows/
git add .github/workflows/update-visa-bulletin.yml
git commit -m "ci: add monthly Visa Bulletin scrape workflow"
git push
```

1. Cron runs several mid-month days (`11,13,15,17,19` at 15:00 UTC) and on `workflow_dispatch`.
2. [`scripts/scrape-visa-bulletin.mjs`](scripts/scrape-visa-bulletin.mjs) fetches the target bulletin HTML from travel.state.gov (falls back to the Internet Archive CDX API when Cloudflare blocks live fetch). Bulletin URLs use the DOS **fiscal-year** folder (Oct–Sep). Historical bulk import: `node scripts/backfill-bulletins.mjs --from 2021-09 --to 2023-09`.
3. [`scripts/lib/parse-bulletin.mjs`](scripts/lib/parse-bulletin.mjs) extracts employment **Table A** and **Table B**, encoding **C→null** and **U→`"U"`**.
4. Optionally scrapes USCIS for that month’s AOS chart selection into `uscisAosChart` (does **not** overwrite historical A/B cells).
5. If JSON changed and parse succeeded, opens a PR with the updated `src/data/visa-bulletins.json`.

Manual run:

```bash
npm run scrape:bulletin
# or
node scripts/scrape-visa-bulletin.mjs --id 2026-09
node scripts/scrape-visa-bulletin.mjs --file ./saved-bulletin.html --id 2026-09
```

If live + Wayback both fail (Cloudflare), save the official HTML/PDF in a browser and pass `--file`.

## Out of scope (MVP)

- Native iOS app (API is ready for one later)
- Auth / paywall
- USCIS case-status scraping
- Family-sponsored tables (employment-only)

## License / attribution

Visa Bulletin figures are U.S. government works. This repository’s code is provided as-is for educational use. Not legal advice.
