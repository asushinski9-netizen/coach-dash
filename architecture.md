# Coach Dashboard — Architecture (v2.3)

## Overview

Single HTML file (`index.html`, ~2,740 lines). No build step, no external dependencies. All state lives in `localStorage`. Logo embedded as base64 data URI. Must be served from `localhost` (not `file://`) for the Google Sheets sync to work — use `start.py` or `start.bat`. GitHub QT sync uses a plain `fetch()` and works the same from `file://` or `localhost` (subject to the browser's own CORS rules for the target domain — `raw.githubusercontent.com` allows cross-origin reads).

---

## System Architecture

```
Google Sheet (private)                      GitHub repo (public, read-only)
  └─ Apps Script Web App                       └─ county_qt.json
       ├─ Auth: shared token via                  regional_qt.json
       │  PropertiesService
       ├─ Reads: Basic Data tab (swimmers)
       ├─ Reads: Results tab (races, DQ            │
       │  detection by cell colour)                │
       ├─ Computes: PBs per swimmer/event/course    │
       └─ Returns: {version, generated,             │
                     count, swimmers:[]} JSON        │
              │                                      │
              ▼                                      ▼
  ┌─────────────────────────────────────────────────────────┐
  │  Dashboard (index.html) — localhost       │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │ localStorage:                                    │    │
  │  │  coach_SWIMMERS, coach_COUNTY_QT_FULL,            │    │
  │  │  coach_REGIONAL_QT_FULL, coach_SYNC_URL,          │    │
  │  │  coach_SYNC_TOKEN, coach_SHEETS_LAST_SYNC,        │    │
  │  │  coach_COUNTY_QT_LAST_SYNC,                       │    │
  │  │  coach_REGIONAL_QT_LAST_SYNC, coach_theme         │    │
  │  └─────────────────────────────────────────────────┘    │
  │  📤 Manage Data modal — one card per data source:        │
  │     sync button · file upload (with conflict resolution) │
  │     · download · clear                                   │
  └─────────────────────────────────────────────────────────┘
```

---

## HTML File Layout

```
<head>
  <style>   CSS variables, layout, components, data-card / sync / settings styles, mobile overrides
</head>
<body>
  .header               Sticky top bar with logo and club name
  .tabs                 Tab navigation (County QT / Regional QT / two Editor tabs)
  .container
    #tab-county         County QT panel
    #tab-regional       Regional QT panel
    #tab-county-editor  County QT Editor (desktop only)
    #tab-regional-editor Regional QT Editor (desktop only)

  Modals (4 total, each a unique #id):
    #dataModal          📤 Manage Data — sync / upload / download / clear, per source
    #addSwimmerModal    Add / Edit Swimmer
    #settingsModal       ⚙️ Sync URL + Token entry (Google Sheets)
    #syncModal           🔄 Sync from Google Sheets — opened FROM inside #dataModal's
                          Swimmers card, not from its own FAB button (removed in v2.3)

  FAB speed dial (4 children): ＋ → 👤 Add Swimmer / 📤 Manage Data / ⚙️ Settings / 🌙 Theme

<script>
  CONFIGURATION       SHEETS_SYNC_URL (blank — set via Settings), QT_DATA_URL,
                       SE_QT_DATA_URL (GitHub raw URLs for County/Regional QT)
                       NOTE: no hardcoded championship dates — see "Championship Dates" below
  MODULE-LEVEL UTILS  STATUS_RANK, escAttr, lsGet
  DATA GLOBALS        SWIMMERS, COUNTY_QT, REGIONAL_QT, QT_META objects
  UTILITIES           timeToSec, secToTime, fmtDate, parseLocalDate, escHtml, initials
  AGE BRACKETS        getSeasonYear, getCountyChampsDate, getRegionalChampsDate,
                       getCountyAgeBracket, getRegionalAgeBracket
  QT LOOKUP           parseQTFull, lookupQT, calcStatus, buildSwimmerRows
  EVENT-LEVEL STATUS  getEventBestStatuses
  PROGRESS BAR        buildProgressBar
  INFO BANNER         buildBanner
  RENDER TAB          renderTab (shared), renderCounty, renderRegional
  QT EDITOR           renderQTEditor, saveQTEdit, deleteQTRow, addQTRow, saveNewQTRow
  COMPETITION META    toggleMetaEdit, cancelMetaEdit, saveMetaEdit, updateMetaDisplay
  QT DOWNLOAD         downloadQTData, saveQTToStorage
  RESET / FILTER      resetFilters, resetQTFilters
  TAB SWITCHING       showTab, toggleCollapseAll, toggleSwimmer, updateCollapseBtnVisibility
  THEME               toggleTheme
  MANAGE DATA MODAL   showDataModal, hideDataModal, refreshDataModalStatus,
                       setDataStatus, clearDataStatus, setDataError, readJsonFile,
                       sanitiseSwimmersData, showDataConflict, cancelDataConflict,
                       resolveDataConflict, loadSwimmersFile, applySwimmersUpload,
                       loadQTFile, applyQTUpload, syncQTFromGitHub, clearData,
                       downloadSwimmers, checkLocalStorageSize
  SWIMMER CRUD        showAddSwimmerModal, hideAddSwimmerModal, editSwimmer,
                       deleteSwimmer, saveSwimmer, addPBRow
  FAB                 toggleFab, openFab, closeFab, fab* functions
  KEYBOARD            ESC handler (closes all modals + FAB)
  INIT                DOMContentLoaded — logo, theme, renders County tab
  GOOGLE SHEETS SYNC  showSyncModal, hideSyncModal, toggleTokenVisibility,
                       showSettingsModal, hideSettingsModal, saveSettings,
                       startSync, mergeSwimmers, mergePbs, setSyncStatus
  LOGO DATA URI       const LOGO_DATA_URI (base64, ~14 KB)
```

**Note:** `loadSampleData()` and its six hardcoded fictional swimmers were removed in v2.3. First-time load with no data now shows a genuine empty state directing the coach to 📤 Manage Data.

---

## CSS Variables

Two complete variable sets — light (`:root`) and dark (`body.dark`):

```css
--bg, --surface, --surface2, --surface3   Background layers
--accent (#1a56c4), --accent2 (#0ea5d4)   Blue / teal accent
--gold (#d97706)                           PB times, amber highlights, warning hints
--green, --red                             Status colours
--text, --text2, --text3                   Text hierarchy
--border                                   Borders / dividers
--tab-active                               Active tab background
--header-start, --header-end               Header gradient
```

Sync/data-modal-specific classes: `.sync-success`, `.sync-error`, `.sync-info`, `.source-badge-sheet`, `.source-badge-local`, `.data-card`, `.data-card-head`, `.data-card-title`, `.data-card-row`. `.fbtn:disabled` dims and disables Download/Clear buttons when a data source is empty.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤500 px (mobile) | Tabs wrap 2-per-row; stat cards compact; filter bar 2-column grid; progress column hidden; gender pill shown; QT editor tabs hidden |
| >500 px (desktop) | Full layout; QT editor tabs visible |

Key CSS helpers: `.col-full` / `.col-abbr`, `.desktop-tab`, `.gender-pill-mobile`

FAB has 4 children — CSS transition delays at 0.00 / 0.05 / 0.10 / 0.15s.

---

## Data Flow

### Rendering
```
localStorage (coach_SWIMMERS, coach_COUNTY_QT_FULL, coach_REGIONAL_QT_FULL)
  ↓ lsGet() + parseQTFull()
SWIMMERS[], COUNTY_QT[], REGIONAL_QT[], COUNTY_QT_META, REGIONAL_QT_META
  ↓
renderTab(prefix)
  → buildBanner(isCounty)         — reads championship date from QT_META, runs FIRST,
                                     before any empty-data early return (so the banner
                                     is always current even when qtData.length === 0)
  → filter SWIMMERS (hidden flag, Former Swimmer gate, filters)
  → buildSwimmerRows(swimmer, qtData, ageFn, ...)
      → ageFn(dob) — null if no championship date is set; lookupQT then finds nothing
      → lookupQT → calcStatus (normalises inverted data defensively)
  → getEventBestStatuses(rows)   — best status per event across SC+LC
  → renderStatCards              — 3 top stat cards (swimmer-level counts)
  → swimmer card HTML            — badges + table rows
      → buildProgressBar         — per event+course row
  → updateCollapseBtnVisibility  — hides "Collapse All" when no cards rendered
```

### Manage Data modal flow
```
showDataModal() → refreshDataModalStatus()
  → per-card counts, last-sync timestamps, button enabled/disabled state
  → cross-reference hints (e.g. "swimmers loaded but no QT data yet")

Sync (Sheets):  Swimmers card → showSyncModal() → startSync() → mergeSwimmers()
                 → SWIMMERS reassigned → localStorage → renderCounty/Regional()
                 → refreshDataModalStatus() (modal underneath updates immediately)

Sync (GitHub):  County/Regional card → syncQTFromGitHub(prefix)
                 → fetch(QT_DATA_URL | SE_QT_DATA_URL) → parseQTFull()
                 → COUNTY_QT/REGIONAL_QT + META reassigned → localStorage
                 → coach_COUNTY_QT_LAST_SYNC / coach_REGIONAL_QT_LAST_SYNC stamped
                 → renderCounty/Regional() + refreshDataModalStatus()

Manual upload:  loadSwimmersFile() / loadQTFile(prefix)
                 → readJsonFile() → if existing data present → showDataConflict()
                 → user picks Replace / Merge / (QT only) Merge-overwrite
                 → resolveDataConflict(mode) → applySwimmersUpload / applyQTUpload

Clear:          clearData('swimmers' | 'county' | 'regional' | 'all')
                 → confirm() → wipe arrays + remove ALL related localStorage keys
                 → (including *_LAST_SYNC for the cleared source)
                 → refreshDataModalStatus() + re-render
```

---

## Key Business Logic

### Championship dates — no longer hardcoded (v2.3 change)

Pre-v2.3, `COUNTY_CHAMPS_DATE` / `REGIONAL_CHAMPS_DATE` were hardcoded constants requiring manual seasonal updates. As of v2.3, the championship date is derived entirely from QT metadata:

```js
function getCountyChampsDate()   { return COUNTY_QT_META.dateTo || COUNTY_QT_META.dateFrom || ''; }
function getRegionalChampsDate() { return REGIONAL_QT_META.dateTo || REGIONAL_QT_META.dateFrom || ''; }
```

- Prefers `dateTo` (last day of the championships); falls back to `dateFrom` if only one is set.
- Returns `''` if neither is set — `getCountyAgeBracket()`/`getRegionalAgeBracket()` then return `null` rather than computing against `Invalid Date`.
- `QT_META.dateFrom`/`dateTo` come from: (a) the `meta` block of a synced/uploaded QT JSON file, or (b) manual entry via ✏️ Edit Details on the relevant QT Editor tab. Manual edits persist until the next sync/upload overwrites `QT_META`.
- `buildBanner()` shows an explicit "No QT data loaded — Age Groups can't be calculated" message when the date is missing, instead of silently computing nonsense. This banner is built **before** any empty-data early return in `renderTab`, so it's always current.

### Age bracket calculation
```
getSeasonYear(champDateStr)
  → today > champDate ? champDate.year + 1 : champDate.year

getCountyAgeBracket(dob)   → null if no champ date; else "10+11" | "12".."16" | "17+"
getRegionalAgeBracket(dob) → null if no champ date; else "11/12" | "13".."17" | "18+"
```

### Status precedence
`STATUS_RANK`: `Qualified(0) > Consideration(1) > Outside(2) > No PB(3) > No Data(4)`

`getEventBestStatuses(rows)` returns best status per event across all courses — used for stat card counts and row border colours.

### Inverted QT data guard
`calcStatus` and `buildProgressBar` both normalise via `Math.min`/`Math.max` before comparing — generic protection against any future data-entry error, kept even though the specific historical example (Girls/17+/SC/200 IM in `county_qt.json`) has been corrected at source.

### Swimmer merge (Sheets sync — `mergeSwimmers`)
- Match key: `name.toLowerCase().trim() + '|' + dob`
- Sheet wins on PBs (fastest time across all competitions, via `mergePbs`)
- Local `competition` field preserved if Sheet doesn't have one
- `source: 'sheet'` or `'local'` flag set on each swimmer; shown as a badge on the card
- `hidden: true` swimmers excluded from all renders and stat counts
- Merge modes (Sync modal dropdown): keep / hide / remove local-only swimmers

### Manual swimmer upload conflict resolution (`applySwimmersUpload`)
If swimmers already exist when a file is uploaded: **Replace** (discard existing, load file) or **Merge** (same matching logic as `mergeSwimmers`, local-only swimmers always kept since this isn't an authoritative sheet sync).

### Manual QT upload conflict resolution (`applyQTUpload`) — 3 modes
If QT rows already exist when a file is uploaded, by `gender|course|event|age` key:
- **Replace** — discard existing rows and metadata, load the file's data wholesale.
- **Merge — add new only** — add rows for combinations not already present; existing rows untouched.
- **Merge — overwrite matching** — add new rows AND overwrite `qualify`/`consider` on any row that already exists with the uploaded values.

### Former Swimmer gate
```
if (!showFormer && squadFilter !== 'Former Swimmer' && sw.squad === 'Former Swimmer')
  → skip swimmer
```

### Empty state logic (`renderTab`)
`renderTab` checks `qtData.length === 0` first:
- If swimmers exist → "📂 N swimmer(s) loaded — but no QT standards loaded yet" + 📤 Manage Data button
- If no swimmers either → generic "no data loaded yet" + 📤 Manage Data button
- `updateCollapseBtnVisibility(prefix, false)` hides Collapse All in both empty-data cases, and whenever zero cards actually render after filtering.

---

## localStorage Key Map

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage (via applyQTUpload, syncQTFromGitHub, QT Editor edits) | |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage (same call sites, regional) | |
| `coach_COUNTY_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+; cleared by clearData('county'/'all') |
| `coach_REGIONAL_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+; cleared by clearData('regional'/'all') |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` | string | saveSettings, startSync (if entered inline) | Apps Script Web App URL — same value for every coach |
| `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared secret token — NOT per-coach; see Settings modal copy |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | Cleared by clearData('swimmers'/'all') |
| `coach_COUNTY_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub('county') | Cleared by clearData('county'/'all') |
| `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub('regional') | Cleared by clearData('regional'/'all') |

All startup reads use `lsGet(key, fallback)` — wraps `JSON.parse` in try/catch, logs warning and returns fallback on corrupt data rather than crashing.

---

## Apps Script (apps_script_v2.2.1.gs) — unchanged in v2.3

Key functions:

| Function | Purpose |
|---|---|
| `doGet(e)` | Entry point — token check via PropertiesService, calls buildPayload() |
| `buildPayload()` | Reads both tabs, processes all rows, returns swimmer array |
| `getFinalCumColIndex(eventName)` | Derives final cumulative column: 6 + (dist/50 × 2) − 1 |
| `isDqColour(colour)` | Checks hex against known yellow DQ values |
| `formatName(sheetName)` | LASTNAME, FIRSTNAME → Firstname Lastname |
| `formatDob(val)` | DD/MM/YYYY or Date → YYYY-MM-DD |
| `mapGender(raw)` | M/F → Boys/Girls |
| `mapSquad(raw)` | Normalises squad names via SQUAD_MAP |
| `testRun()` | Manual test — run in Script Editor to verify before deploying |
| `setToken()` | One-time helper to set ACCESS_TOKEN via PropertiesService |

Event mapping (Sheet → dashboard):
`50 FS→50 Free, 100 FS→100 Free, ..., 50 BK→50 Back, ..., 50 BRST→50 Breast, ..., 50 FLY→50 Fly, ..., 100 IM→100 IM, 200 IM→200 IM, 400 IM→400 IM`

**Single shared token model:** there is one `ACCESS_TOKEN` in the Apps Script's Script Properties. Every coach pastes the *same* URL and token into their own browser's Settings — this keeps the token out of the public HTML source, but it is not per-coach authentication. Anyone with the token has identical access. See Settings modal copy in the dashboard for the user-facing version of this explanation.
