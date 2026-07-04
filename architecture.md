# Coach Dashboard — Architecture (v2.4)

## Overview

Single HTML file (`index.html`, ~2,930 lines). No build step, no dependencies beyond the CDN-free vanilla JS in the page itself. All state lives in `localStorage`. Logo is embedded as a base64 data URI so the file is fully self-contained. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal.

---

## File Layout

```
<head>
  <style>          CSS variables, layout, component styles, mobile overrides
</head>
<body>
  .header          Sticky top bar with logo and club name
  .tabs            Tab navigation (County QT / Regional QT / two Editor tabs, desktop only)
  .container
    #tab-county         County QT panel
    #tab-regional       Regional QT panel
    #tab-county-editor  County QT Editor (desktop only)
    #tab-regional-editor Regional QT Editor (desktop only)
  Modals:
    #dataModal        📤 Manage Data — one card per source (sync/upload/download/clear)
    #syncModal        🔄 Sync from Google Sheets (token, merge mode, last-synced)
    #settingsModal     ⚙️ Settings (Apps Script URL + token)
    #addSwimmerModal   Add / Edit Swimmer
  FAB speed dial     ＋ → 👤 Add Swimmer / 📤 Manage Data / ⚙️ Settings / 🌙 Theme
<script>
  1.  CONFIGURATION        GitHub QT sync URLs, Apps Script URL constant, ALL_EVENTS, avatar colours
  2.  MODULE-LEVEL UTILS   STATUS_RANK, escAttr (onclick-attribute escaping)
  3.  DATA GLOBALS         SWIMMERS, COUNTY_QT, REGIONAL_QT, QT_META objects, parseQTFull, lsGet
  4.  UTILITIES            timeToSec, secToTime, fmtDate, fmtDateTime, parseLocalDate, escHtml, initials
  5.  AGE BRACKETS         getSeasonYear, getCountyChampsDate/getRegionalChampsDate,
                           getCountyAgeBracket, getRegionalAgeBracket
  6.  QT LOOKUP            lookupQT, calcStatus, sanitiseSwimmersData
  7.  DIAGNOSTIC           diagnoseZeroRowSwimmer — why a swimmer's card doesn't render
  8.  BUILD SWIMMER ROWS   buildSwimmerRows
  9.  PROGRESS BAR         buildProgressBar
  10. INFO BANNER          buildBanner, describeChampDates
  11. EVENT-LEVEL STATUS   getEventBestStatuses
  12. RENDER TAB           buildFooterNote, renderTab (shared), renderCounty, renderRegional
  13. TAB SWITCHING        showTab, toggleCollapseAll, toggleSwimmer, updateCollapseBtnVisibility
  14. THEME                toggleTheme, applyTheme
  15. DATA: LOAD/SAVE      showDataModal, sanitiseSwimmersData, applySwimmersUpload,
                           applyQTUpload, resolveDataConflict, downloadSwimmers, clearData
  16. LOCALSTORAGE GUARD   checkLocalStorageSize
  17. ADD SWIMMER          showAddSwimmerModal, addPBRow
  18. EDIT/DELETE SWIMMER  editSwimmer, deleteSwimmer, saveSwimmer
  19. QT EDITOR SAVE        saveQTToStorage
  20. QT EDITOR META       toggleMetaEdit, cancelMetaEdit, saveMetaEdit, updateMetaDisplay
  21. QT EDITOR TABLE       resetQTFilters, renderQTEditor, saveQTEdit, deleteQTRow
  22. QT EDITOR ADD ROW     addQTRow, saveNewQTRow
  23. QT EDITOR DOWNLOAD    downloadQTData
  24. FAB                  toggleFab, openFab, closeFab, fabToggleTheme, fabShowDataModal, ...
  25. KEYBOARD              ESC handler
  26. LOGO DATA URI         const LOGO_DATA_URI (base64)
  27. INIT                  DOMContentLoaded — logo, theme, restore last-sync display, renderCounty
  28. GOOGLE SHEETS SYNC    startSync, mergeSwimmers, mergePbs, showSyncModal, showSettingsModal
```

---

## CSS Variables

Two complete variable sets — light (`:root`) and dark (`body.dark`):

```css
--bg, --surface, --surface2, --surface3   Background layers
--accent (#1a56c4), --accent2 (#0ea5d4)   Blue / teal accent
--gold (#d97706)                           PB times, amber highlights, warning-tier diagnostics
--green, --red                             Status colours
--text, --text2, --text3                   Text hierarchy
--border                                   Borders / dividers
--tab-active                               Active tab background
--header-start, --header-end               Header gradient
```

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤500 px (mobile) | Tabs wrap; stat cards compact; filter bar becomes grid; progress column hidden; gender pill; swimmer badges stack; QT editor tabs hidden |
| >500 px (desktop) | Full layout; QT editor tabs visible |

---

## Data Flow

```
localStorage
  ↓ parseQTFull() / lsGet()
COUNTY_QT (array) + COUNTY_QT_META (object)
REGIONAL_QT (array) + REGIONAL_QT_META (object)
SWIMMERS (array)
  ↓
renderTab(prefix)
  → visibleSwimmers = SWIMMERS filtered by hidden/Former-gate/squad/gender/age/name
  → excludedSwimmers seeded here with 'hidden' / 'former' reasons (default gates,
    independent of any explicit filter — see Diagnostic section below)
  → buildSwimmerRows(swimmer, qtData, ageFn, ...) per visible swimmer
      → lookupQT → calcStatus
      → if zero rows: diagnoseZeroRowSwimmer() adds a 'no-match' / 'no-pbs' / 'filtered' entry
  → getEventBestStatuses(rows)      — best status per event across SC+LC
  → renderStatCards                 — 3 top stat cards (swimmer-level counts)
  → swimmer card template           — per swimmer: badges + table
      → buildProgressBar            — per event+course row
  → buildFooterNote(renderedCount, excludedSwimmers, tabLabel, seasonNote)
      — shared across every renderTab exit path (empty-QT, empty-filtered, and the
        main render), so "not shown" accounting is consistent everywhere, not just
        on the happy path
```

### QT Storage

```
coach_COUNTY_QT_FULL   = { meta: {title, dateFrom, dateTo}, times: [...] }
coach_REGIONAL_QT_FULL = { meta: {title, dateFrom, dateTo}, times: [...] }
```

`parseQTFull()` accepts both this format and the legacy plain-array format.

---

## Key Business Logic

### Age bracket calculation

Championship dates are **not hardcoded** (removed in v2.3). `getCountyChampsDate()`/`getRegionalChampsDate()` read `QT_META.dateTo`, falling back to `dateFrom`, returning `''` if neither is set — in which case age-bracket functions return `null` rather than computing against an invalid date, and `buildBanner()` shows an explicit "can't calculate Age Groups" message.

```
getSeasonYear(champDate)
  → if today > champDate: return champDate.year + 1   (next season)
  → else: return champDate.year

getCountyAgeBracket(dob)    → ≤11 → "10+11", ≥17 → "17+", else String(age)
getRegionalAgeBracket(dob)  → ≤12 → "11/12", ≥18 → "18+", else String(age)
```

### Championship date display (`describeChampDates`, added v2.4)

`champDate` (from `getCountyChampsDate`/`getRegionalChampsDate`) is `dateTo` when both dates are set — i.e. the **last** day, not "the" day of a potentially multi-day event. `describeChampDates(qtMeta, isPast)` produces accurate phrasing for five distinct shapes, each in past- and upcoming-tense:

| Shape | Phrasing |
|---|---|
| `dateFrom` + `dateTo`, different | "took place from 7 Feb to 15 Feb" |
| `dateFrom` + `dateTo`, same (genuine single day) | "took place on 15 Feb" |
| only `dateTo` known | "concluded on 15 Feb" |
| only `dateFrom` known | "began on 7 Feb" |

Used by `buildBanner()` in both its past-event and upcoming-event branches.

### Status precedence

`STATUS_RANK`: `Qualified(0) > Consideration(1) > Outside(2) > No PB(3) > No Data(4)`. `getEventBestStatuses(rows)` returns the best status per event name across all courses — used for swimmer card summary badges, top stat card counts, and row border colour.

### Inverted QT data guard

`calcStatus` and `buildProgressBar` normalise `qualify`/`consider` via `Math.min`/`Math.max` before any comparison, defending against source data where `consider < qualify`.

### "Not shown" diagnostic (`diagnoseZeroRowSwimmer`, `buildFooterNote` — added/extended throughout v2.4)

A swimmer's whole card is omitted (not shown as "no PB," just absent) whenever `buildSwimmerRows()` returns zero rows for them. Historically this happened silently. As of v2.4, every exclusion path is categorised and surfaced in an expandable footer note per tab:

| Reason | Meaning | Where computed |
|---|---|---|
| `no-match` | Zero QT rows matched this gender+age-bracket combination at all — most likely a malformed `dob` or a `gender` value that isn't exactly `"Boys"`/`"Girls"` (data problem, not a "no PB" case) | `diagnoseZeroRowSwimmer`, on swimmers within `visibleSwimmers` |
| `no-pbs` | QT rows matched, but zero real PBs recorded against any of them | `diagnoseZeroRowSwimmer` |
| `filtered` | Real PB(s) recorded, but none satisfy the currently active Course/Stroke/Status filter — described using their actual best status, not a generic message | `diagnoseZeroRowSwimmer`, given `{ courseFilter, strokeFilter, statusFilter }` |
| `former` | `squad === 'Former Swimmer'`, hidden by the default gate (independent of any filter) | seeded directly from `SWIMMERS`, before `visibleSwimmers` is computed |
| `hidden` | `sw.hidden === true` — demoted to local-only and hidden by a Sheets sync "Hide" merge | seeded directly from `SWIMMERS`, before `visibleSwimmers` is computed |

`former`/`hidden` are seeded from the full `SWIMMERS` array specifically because they're excluded from `visibleSwimmers` one step *before* the other three categories are ever evaluated — a swimmer hidden by these gates never reaches the per-row diagnostic at all unless accounted for separately. Explicit Gender/Age/Squad/Name-search filter exclusions are deliberately **not** tracked here — those are self-evident from the visible filter bar the coach just set, unlike a default gate active even with no filters applied.

`buildFooterNote()` only applies the alarming gold/⚠️ summary styling when `no-match` entries exist (an actual problem to investigate); every other reason renders in neutral grey, since they're all expected states.

### Former Swimmer gate

```
if (!showFormer && squadFilter !== 'Former Swimmer' && sw.squad === 'Former Swimmer')
  → skip swimmer
```

### `mergeSwimmers()` — dual-purpose merge (fixed v2.4)

Shared by two call sites with different semantics, distinguished by `opts.sourceIsAuthoritative`:

- **Sheets sync** (`sourceIsAuthoritative: true`) — the incoming set is a complete, authoritative snapshot of the Sheet. Existing swimmers tagged `source:'sheet'` absent from it are assumed genuinely removed upstream, and `mergeMode` (keep/hide/remove) applies to them.
- **Manual upload merge** (`sourceIsAuthoritative: false`) — the incoming set is just whatever was in that file, never a full snapshot of anything. Existing swimmers absent from it are **always** kept regardless of their `source` tag.

Getting this wrong (both call sites previously shared the `true` behaviour unconditionally) caused a real bug: merging a manual upload with 62 Sheets-synced swimmers made all 62 disappear, since none of them were present in the uploaded file and all were tagged `source:'sheet'`.

---

## Security Notes (added v2.4)

- **`escAttr()`** escapes for a value embedded in `onclick="fn('${value}')"` — a JS single-quoted string literal nested inside an HTML double-quoted attribute. It must escape *both* layers: backslash/single-quote for the JS layer, then `&`/`"`/`<`/`>` (HTML-entity encoded) for the attribute layer, in that order. Getting only the first layer right (the state before v2.4) left a real attribute-breakout injection via any field passed through it — `sw.id`, and the QT editor's `gender`/`course`/`event`/`age`.
- **`escHtml()`** is for plain HTML text-content interpolation (never inside an attribute) — used for swimmer names, squad, gender, and QT editor's `gender`/`event` display cells.
- Neither manual-upload validator (`sanitiseSwimmersData` for swimmers, none at all for QT files) constrains every field that ends up rendered — the escaping functions are the actual security boundary, not input validation. See `known-bugs-and-fixes.md` Open Issue #7.
- Sync token is sent as a URL query parameter, not a header — see `known-bugs-and-fixes.md` Open Issue #1.

---

## localStorage Key Map

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+ |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` / `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared by all coaches — not per-coach auth |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | Cleared by clearData('swimmers'/'all'); displayed via `fmtDateTime()` (v2.4), re-read fresh on every Sync modal open (v2.4) |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub | Cleared by clearData('county'/'regional'/'all') |

`checkLocalStorageSize()` sums the three main data keys and logs a console warning above 4 MB.

---

## FAB Speed Dial

Bottom-right fixed button (＋), expands into 4 children: 👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙/☀️ Theme. Backdrop click and ESC both close the dial; ESC also cancels any open modal or meta-edit form.
