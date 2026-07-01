# Coach Dashboard — Handover Document (v2.3)

**Dashboard:** `index.html` · **~2,740 lines** · Self-contained (logo embedded as base64)
**Apps Script:** `apps_script_v2.2.1.gs` · **252 lines** · Bound to Google Sheet, unchanged this release
**Read this first if you're picking this project up in a new chat session.**

---

## 1. What It Does

A single-file HTML coaching dashboard for Broomfield Park SC. Shows every swimmer's Personal Bests against County and Regional qualifying times. Three independent data sources, each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal:

1. **Swimmers & PBs** — synced live from a private Google Sheet via a Google Apps Script Web App, or uploaded/downloaded as `swimmers_pb.json`.
2. **County QT data** — synced from a GitHub-hosted `county_qt.json`, or uploaded/downloaded/edited inline via the QT Editor tab.
3. **Regional QT data** — same, for `regional_qt.json`.

**Related tool:** Individual swimmer dashboard (`swim-dash`) at `asushinski9-netizen.github.io/swim-dash` — uses the same QT JSON file formats.

---

## 2. How to Run

Must be served from `localhost` — not opened as a `file://` URL. The `fetch()` call to the Apps Script (Sheets sync) fails with a CORS error from `file://` origin. (GitHub QT sync via `fetch()` is more tolerant of `file://` but localhost is still recommended for consistency.)

```
python3 start.py        # Mac/Linux — auto-finds free port, opens browser
start.bat                # Windows
```
Or manually: `python3 -m http.server 8000` then open `http://localhost:8000/index.html`

---

## 3. Championship Dates — Important Change in v2.3

**There is no hardcoded championship date constant anymore.** Previous versions had `COUNTY_CHAMPS_DATE`/`REGIONAL_CHAMPS_DATE` requiring manual seasonal updates in the source code. As of v2.3, Age Group calculation, the info banner, and the swimmer-table footer note all read the championship date from **QT metadata** instead:

```js
function getCountyChampsDate()   { return COUNTY_QT_META.dateTo || COUNTY_QT_META.dateFrom || ''; }
function getRegionalChampsDate() { return REGIONAL_QT_META.dateTo || REGIONAL_QT_META.dateFrom || ''; }
```

This metadata comes from either:
- the `meta.dateFrom`/`meta.dateTo` block of a synced (GitHub) or uploaded QT JSON file, or
- manual entry via ✏️ Edit Details on the County/Regional QT Editor tab.

**If no QT data is loaded at all, Age Groups can't be calculated** — the dashboard shows this explicitly (banner text, footer note) rather than guessing or crashing. This is intentional, confirmed with the project owner.

If you're asked to touch anything age-bracket related, search for `getCountyChampsDate`/`getRegionalChampsDate`/`getCountyAgeBracket`/`getRegionalAgeBracket` — there are exactly 4 consumers of the championship date and all 4 were updated together in v2.3. Don't reintroduce a hardcoded constant.

---

## 4. First-Time Setup (new browser / new coach)

1. Open ⚙️ Settings (FAB button) → paste the Apps Script Web App URL + sync token → Save.
   (Alternatively, the URL/token can now be entered directly in the Sync modal itself if Settings hasn't been configured yet — added in v2.3 to avoid a dead-end warning.)
2. Open 📤 Manage Data (FAB button):
   - Swimmers card → 🔄 Sync from Google Sheet
   - County QT card → 🔄 Sync from GitHub
   - Regional QT card → 🔄 Sync from GitHub

URL and token are stored in `localStorage` only — not in the file. The HTML can be shared freely with other coaches; each pastes the **same** URL and token (see §6 below — this is not per-coach authentication).

---

## 5. Architecture Summary

```
Google Sheet (private)                    GitHub repo (public, read-only)
  └─ Apps Script Web App                     └─ county_qt.json / regional_qt.json
       Token auth via PropertiesService

Dashboard (localhost)
  ├─ SWIMMERS[], COUNTY_QT[], REGIONAL_QT[] + META objects, all in localStorage
  ├─ 📤 Manage Data modal — 3 cards (Swimmers / County QT / Regional QT):
  │    sync button → cross-reference hint → upload row → download/clear row
  │    manual uploads over existing data trigger a Replace/Merge conflict prompt
  ├─ QT Editor tabs (desktop only) — inline editing, competition metadata (dates!)
  └─ FAB: 👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙 Theme
       (no more standalone Sync FAB — sync lives inside Manage Data)
```

Full detail in `architecture.md`. Full JSON shapes in `data-schema.md`.

---

## 6. Single Shared Token — Not Per-Coach Auth

There is exactly **one** `ACCESS_TOKEN` set in the Apps Script's Script Properties. Every coach pastes the *same* URL and token into their own browser. This keeps the token out of the public HTML source (good), but it is **not** per-coach login — anyone with the token has identical access, and there's no way to revoke one coach without changing it for everyone. The Settings modal copy in the dashboard was corrected in v2.3 to say this accurately; earlier versions implied individual credentials, which wasn't true. If asked to add real per-coach revocation, that's a nontrivial Apps Script change (token→coach map), not yet implemented.

---

## 7. localStorage Keys

| Key | Purpose |
|---|---|
| `coach_SWIMMERS` | All swimmer profiles + PBs |
| `coach_COUNTY_QT_FULL` | County QT data + metadata (incl. championship dates) |
| `coach_REGIONAL_QT_FULL` | Regional QT data + metadata |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Legacy plain-array fallback, read-only, never written |
| `coach_SYNC_URL` | Apps Script Web App URL (shared) |
| `coach_SYNC_TOKEN` | Shared auth token |
| `coach_SHEETS_LAST_SYNC` | Timestamp of last successful Sheets sync |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | Timestamp of last successful GitHub sync, per QT source (new in v2.3) |
| `coach_theme` | `'light'` or `'dark'` |

Every one of these is cleared appropriately by the 🗑 Clear buttons in Manage Data — swimmers-clear also clears `coach_SHEETS_LAST_SYNC`, county-clear also clears `coach_COUNTY_QT_LAST_SYNC` (and the legacy fallback key), etc. If you add a new persisted key, wire it into `clearData()` too, or you'll reproduce the exact staleness bug fixed in v2.3 turn 6.

---

## 8. Data Schemas (summary — full detail in `data-schema.md`)

**Swimmer:** `{id, name, dob(YYYY-MM-DD), gender(Boys/Girls), squad, source(sheet/local), hidden(bool), pbs[]}`

**PB entry:** `{event, course(S/L), time(mm:ss.hh or ss.hh), date(YYYY-MM-DD), competition?}`

**QT file:** `{meta:{title,dateFrom,dateTo}, times:[{gender,course(Short/Long Course),event,age,qualify(secs),consider(secs)}]}` — **`dateFrom`/`dateTo` now drive Age Group math dashboard-wide, see §3.**

**Squad values:** Development · Junior · Senior · Active · Masters · Former Swimmer

**Age brackets — County:** 10+11 / 12 / 13 / 14 / 15 / 16 / 17+
**Age brackets — Regional:** 11/12 / 13 / 14 / 15 / 16 / 17 / 18+

---

## 9. Known Issues (see `known-bugs-and-fixes.md` for full history)

1. **Legacy localStorage keys** (`coach_COUNTY_QT`, `coach_REGIONAL_QT`) still read as fallbacks, never written since v2.0. Harmless, could be removed once confident no old device needs them.
2. **Single shared sync token** — see §6.
3. **No offline/retry queue** for either sync path — a failed sync just shows an error; coach re-triggers manually. Consistent behavior across both sync types, not considered a bug.
4. **Documentation was significantly out of date** relative to code as of the start of this session (referenced removed features like `loadSampleData()`, the standalone Sync FAB, hardcoded champ dates). This handover round refreshed all docs — if you're reading this in a *future* session, check the dates/version numbers in each doc still match the HTML file you're actually looking at before trusting them blindly.

---

## 10. A Note on Debugging in This Codebase

Two real production bugs were found and fixed this session by **tracing actual data flow**, not guessing:
- The "swimmer count shows 0 after successful sync" bug was found by grep'ing every call site of `refreshDataModalStatus()` and noticing `startSync()`'s success path was missing from the list.
- The "banner shows stale championship info after QT clear" bug was found by grep'ing every usage of the hardcoded date constants and checking call order relative to early returns in `renderTab`.

When something is reported as "broken" or "not loading" without more detail, this codebase is clean enough (verified via `node --check`, full HTML parse, and actual jsdom execution with `runScripts: 'dangerously'` — see turn 8 in `session-log.md`) that a syntax/structural defect is unlikely to be the cause on the first guess. Prefer: (1) reproduce or trace the exact symptom in code before editing, (2) ask the user what they actually see if the report is vague, rather than speculatively patching. This project has a history (documented in `known-bugs-and-fixes.md`) of copy-paste-across-three-similar-blocks bugs — when fixing one instance of a pattern, grep for siblings before considering it done.

---

## 11. Parked Ideas (from v2.2.1 handover, still not started)

**Overview tab** — "coach's morning briefing" page:
1. Squad qualification snapshot (across both County + Regional simultaneously)
2. "Hot right now" — feed of most recently set PBs, sorted by date
3. "The bubble list" — swimmers within X% of a QT they haven't hit yet
4. Upcoming competition countdown with qualifier counts
5. Swimmers with zero PBs recorded

**Other deferred:** Import PBs from CSV · Event coverage map (grid of events × squads) · Top performers per event (relay selection) · PB age/stale-times alert · Print/PDF view · Swimmer notes field · Sort swimmer list by age group or squad · Per-coach token revocation (see §6).

---

## 12. Files in This Release

| File | Description |
|---|---|
| `index.html` | Main dashboard |
| `apps_script_v2.2.1.gs` | Google Apps Script (unchanged this session) |
| `start.py` / `start.bat` | Localhost launchers |
| `SETUP.md` | Apps Script deployment guide (unchanged) |
| `project-brief.md` | Project overview and goals |
| `architecture.md` | Code structure, data flow, key logic — most detailed technical doc |
| `data-schema.md` | All JSON schemas and field reference |
| `known-bugs-and-fixes.md` | Full bug log with root causes, v1.0 through v2.3 |
| `session-log.md` | Turn-by-turn history of this session plus prior version summaries |
| `coach_dashboard_handover.md` | This document |
