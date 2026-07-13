# Coach Dashboard — Architecture (v2.5)

## Overview

Single HTML file (`index.html`, ~3,550 lines). No build step, no dependencies beyond the CDN-free vanilla JS in the page itself — including the new Overview tab's charts, which are hand-rolled SVG/CSS rather than a charting library, to preserve that self-contained architecture. All state lives in `localStorage`. Logo is embedded as a base64 data URI. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal.

**The Overview tab is now the default tab on page load**, replacing County QT. County/Regional/editor tabs still render lazily on first switch to each.

---

## File Layout

```
<head>
  <style>          CSS variables, layout, component styles, mobile overrides
</head>
<body>
  .header          Sticky top bar with logo and club name (tagline drops to its own row on mobile)
  .tabs            Tab navigation — Overview / County QT / Regional QT / two Editor tabs (desktop only)
                   Mobile: Overview takes the full first row, County+Regional pair up on row 2
  .container
    #tab-overview       Overview — "coach's morning briefing" (NEW, v2.5, default active tab)
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
  1.  CONFIGURATION        GitHub QT sync URLs, Apps Script URL constant, ALL_EVENTS, avatar colours,
                           STROKE_ABBR / STROKE_COLOR (v2.5 — see Overview Tab section)
  2.  MODULE-LEVEL UTILS   STATUS_RANK, escAttr (onclick-attribute escaping)
  3.  DATA GLOBALS         SWIMMERS, COUNTY_QT, REGIONAL_QT, QT_META objects, parseQTFull, lsGet
  4.  UTILITIES            timeToSec, secToTime, fmtDate, fmtDateShort (v2.5), fmtDateTime,
                           parseLocalDate, escHtml, initials, splitEventDistance (v2.5)
  5.  AGE BRACKETS         getSeasonYear, getCountyChampsDate/getRegionalChampsDate,
                           getCountyAgeBracket, getRegionalAgeBracket, getCurrentAge (v2.5 — plain
                           calendar age, independent of QT dates, used only by Squad Composition)
  6.  QT LOOKUP            lookupQT, calcStatus, sanitiseSwimmersData
  7.  DIAGNOSTIC           diagnoseZeroRowSwimmer — why a swimmer's card doesn't render (County/Regional tabs)
  8.  BUILD SWIMMER ROWS   buildSwimmerRows
  9.  PROGRESS BAR         buildProgressBar
  10. INFO BANNER          buildBanner, describeChampDates
  11. EVENT-LEVEL STATUS   getEventBestStatuses
  12. RENDER TAB           buildFooterNote, renderTab (shared), renderCounty, renderRegional
  13. OVERVIEW TAB (v2.5)  See dedicated section below — ~450 lines
  14. TAB SWITCHING        showTab, toggleCollapseAll, toggleSwimmer, updateCollapseBtnVisibility
  15. THEME                toggleTheme, applyTheme
  16. DATA: LOAD/SAVE      showDataModal, sanitiseSwimmersData, applySwimmersUpload,
                           applyQTUpload, resolveDataConflict, downloadSwimmers, clearData
  17. LOCALSTORAGE GUARD   checkLocalStorageSize
  18. ADD SWIMMER          showAddSwimmerModal, addPBRow
  19. EDIT/DELETE SWIMMER  editSwimmer, deleteSwimmer, saveSwimmer
  20. QT EDITOR (SAVE/META/TABLE/ADD ROW/DOWNLOAD)  saveQTToStorage, toggleMetaEdit,
                           saveMetaEdit, updateMetaDisplay, renderQTEditor, saveQTEdit,
                           deleteQTRow, addQTRow, saveNewQTRow, downloadQTData
  21. FAB                  toggleFab, openFab, closeFab, fabToggleTheme, fabShowDataModal, ...
  22. KEYBOARD              ESC handler
  23. LOGO DATA URI         const LOGO_DATA_URI (base64)
  24. INIT                  DOMContentLoaded — logo, theme, restore last-sync display, renderOverview()
  25. GOOGLE SHEETS SYNC    startSync, mergeSwimmers, mergePbs, showSyncModal, showSettingsModal
```

---

## Overview Tab (new in v2.5)

A squad-wide, **unfiltered** "coach's morning briefing" — no Squad/Gender filter bar of its own, deliberately, since it's meant to be a single glance at the whole squad rather than another filterable list like County/Regional. Three sections, in this order: **Squad Composition** (top), **Hot Right Now**, **The Bubble List**.

### Shared building blocks

- **`getOverviewEligibleSwimmers()`** — the default exclusion gate (no `hidden`, not `'Former Swimmer'`) used by every section except where a section has its own explicit override (see Bubble List below).
- **`hiddenReasonDetail(sw)`** — short label + full tooltip for a swimmer excluded by a default gate (`Hidden` / `Former`), used when a section chooses to include them anyway.
- **`splitEventDistance(event)`** + **`STROKE_ABBR`** + **`STROKE_COLOR`** — splits an `ALL_EVENTS` string ("50 Free") into `{distance, stroke}`; maps stroke to a 2–3 letter mobile abbreviation (via the dashboard's existing `.col-full`/`.col-abbr` responsive-text pattern) and to a left-accent-bar color, reusing hex values already established elsewhere in the app (squad/gender colors) rather than a new palette.
- **`renderPersonCard(name, idx, entries, renderEntry, hideReason, expandedSet, toggleFnName)`** — the shared per-swimmer card used by both Hot Right Now and The Bubble List. Shows only `entries[0]` by default (the caller is responsible for pre-sorting entries so the most relevant one is first); a `▾ +N more` button reveals the rest via the passed-in `expandedSet` (a `Set` of expanded swimmer names) and `toggleFnName`. Cards get an `.expanded` class (light-blue background tint, `--accent`-tinted border) while open.
- **Per-entry two-column row** (`.ov-entry-stat`): a small muted "context" block on the left (what was swum), a grouped "result" block on the right (a bold hero stat with a smaller caption directly beneath it — NOT spread apart with `justify-content: space-between`, which was tried and read as scattered/disconnected). A colored left accent bar (via `STROKE_COLOR`) ties the two columns together visually.
- **Section-level card cap**: both Hot Right Now and The Bubble List cap at `HOT_CARD_CAP`/`BUBBLE_CARD_CAP` (10 each — 2 full rows of 5 on desktop). A `hotShowAll`/`bubbleShowAll` boolean (independent of the per-card expand state) plus `toggleHotShowAll()`/`toggleBubbleShowAll()` let a "▾ Show all" / "▴ Show fewer" link on the capped-count note reveal or re-collapse the full list.

### Section 1 — Squad Composition

Three matching interactive pie/donut cards (`renderCompChart(chartId, title, items)`, shared by all three): **By Gender**, **By Squad**, **By Age**. Each card's legend sits to the right of its chart and is clickable — `toggleCompChartKey(chartId, key)` toggles a key in/out of `compChartExcluded[chartId]` (a per-chart `Set`, session-only), and the remaining slices' percentages recompute against whatever's still visible (not the original grand total), with the center total updating to match. A chart with more than 6 legend items (in practice, Age) automatically gets a 2-column legend (`.multi-col`) instead of a scrollable single column.

Age is bucketed by **plain calendar age today** (`getCurrentAge`), not the County/Regional QT age bracket — those only exist once QT metadata (championship dates) is loaded and differ from each other, which would make this section unusable with no QT data loaded at all.

A small transparency note (`renderOverviewExclusionNote`) beneath Composition states how many Former/hidden swimmers aren't counted above.

### Section 2 — Hot Right Now

`collectRecentPbs(limit, cutoffDate)` → `groupRecentPbsBySwimmer()` → `renderHotList()`. PBs with no recorded `date` are excluded (undated entries can't be placed in a chronological feed). A configurable day cutoff (`#hotCutoffDays`, default 30 — `getHotCutoffDays()`/`getHotCutoffDate()`) filters the pool before grouping; the empty state distinguishes "nothing recorded, ever" from "nothing in this particular window" (the latter nudges the coach to widen the window).

Ordering: most-recent-PB-date first, then **most PBs on/around that date** (not name) as the tiebreak — a plain date-only sort degenerates to alphabetical whenever several swimmers share a gala date, which is the normal case, not the exception. This was deliberately chosen over ranking by "fastest for their age," which would just re-surface the same standout swimmers every time rather than reflecting genuinely recent activity.

### Section 3 — The Bubble List

`buildBubbleList(marginPercent, includeHidden)` → `groupBubbleEntriesBySwimmer()` → `renderBubbleList()`. Swimmers with a real, recorded PB within a configurable `%` margin (`#bubbleMargin`, default 5) of a County or Regional QT they haven't yet hit (`status` is `Consideration` or `Outside`, `gapQ > 0`). An "Include hidden / Former Swimmers" checkbox (`#bubbleIncludeHidden`) overrides `getOverviewEligibleSwimmers()` with the full `SWIMMERS` array when checked, tagging each included swimmer with `hiddenReasonDetail()`.

Sort: smallest gap % first (a swimmer's own entries are naturally gap-ascending as a consequence of `buildBubbleList`'s global sort — see inline comment), tiebroken by most bubble opportunities (not name).

Displayed stat: the actual **time difference in seconds and the QT cutoff itself** ("0.12s off" / "QT 2:24.00") — not a percentage or a PB-vs-QT comparison, both tried and replaced per user feedback. No leading `+` sign on the time difference: every entry here is by definition still short of qualifying, so a bare sign invited the wrong reading (faster vs. further away). Meta line is two rows — championship type (County/Regional) on top, event + course underneath — rather than one run-on line.

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

The Overview tab's stroke/squad/gender accent colors (`STROKE_COLOR`, `SQUAD_COLORS`, `GENDER_COLORS`) are plain JS hex constants, not CSS variables — deliberately reusing values already established elsewhere (squad badges, gender pills) rather than introducing a parallel palette. Expanded-card and info-banner tint backgrounds use an `rgba()` overlay on the accent color with a separate `body.dark` override, the same pattern used for the info banner since v1.0.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤500 px (mobile) | Header tagline drops to its own row; Overview tab takes the full first row, County/Regional pair up on row 2; tabs wrap; stat cards compact; filter bar becomes grid; progress column hidden; gender pill; swimmer badges stack; QT editor tabs hidden; Overview card grids go 2-up; stroke names abbreviate (FR/BK/BR/FLY/IM) |
| >500 px (desktop) | Full layout; QT editor tabs visible; Overview card grids go 5-up |

---

## Data Flow

```
localStorage
  ↓ parseQTFull() / lsGet()
COUNTY_QT (array) + COUNTY_QT_META (object)
REGIONAL_QT (array) + REGIONAL_QT_META (object)
SWIMMERS (array)
  ↓
renderOverview()                        — called on load and after every data-changing action
  → renderComposition()                 — 3 pie/donut cards, session-only toggle state
  → renderHotList()                     — card grid, session-only expand + show-all state
  → renderBubbleList()                  — card grid, session-only expand + show-all state
  → renderOverviewExclusionNote()

renderTab(prefix)                       — County/Regional, unchanged from v2.4
  → visibleSwimmers = SWIMMERS filtered by hidden/Former-gate/squad/gender/age/name
  → buildSwimmerRows(swimmer, qtData, ageFn, ...) per visible swimmer
      → lookupQT → calcStatus
      → if zero rows: diagnoseZeroRowSwimmer()
  → getEventBestStatuses(rows)
  → renderStatCards / swimmer card template / buildProgressBar
  → buildFooterNote(...)
```

### QT Storage

```
coach_COUNTY_QT_FULL   = { meta: {title, dateFrom, dateTo}, times: [...] }
coach_REGIONAL_QT_FULL = { meta: {title, dateFrom, dateTo}, times: [...] }
```

`parseQTFull()` accepts both this format and the legacy plain-array format. **No schema changes in v2.5** — the Overview tab reads existing `SWIMMERS`/`COUNTY_QT`/`REGIONAL_QT` structures only.

---

## Key Business Logic (unchanged from v2.4 unless noted)

### Age bracket calculation

Championship dates are **not hardcoded** — `getCountyChampsDate()`/`getRegionalChampsDate()` read `QT_META.dateTo`, falling back to `dateFrom`, returning `''` if neither is set. Used by County/Regional tabs and their age brackets. The Overview tab's Squad Composition deliberately does **not** use this — see "Section 1" above.

### Status precedence

`STATUS_RANK`: `Qualified(0) > Consideration(1) > Outside(2) > No PB(3) > No Data(4)`.

### Inverted QT data guard

`calcStatus` and `buildProgressBar` normalise `qualify`/`consider` via `Math.min`/`Math.max`.

### "Not shown" diagnostic (County/Regional tabs only)

Unchanged from v2.4 — `diagnoseZeroRowSwimmer`/`buildFooterNote`. Not reused by the Overview tab, which has its own simpler exclusion-note pattern (see Section 1).

---

## Security Notes (unchanged from v2.4, still accurate)

- **`escAttr()`** double-layer escapes for `onclick="fn('${value}')"` — JS-string layer then HTML-attribute layer, in that order. Used throughout the new Overview code wherever a dynamic value (swimmer name, chart key) is embedded in an `onclick` attribute.
- **`escHtml()`** for plain HTML text-content interpolation. Used throughout the new Overview code for swimmer names, events, competitions, etc.
- Neither manual-upload validator constrains every field that ends up rendered — the escaping functions are the actual security boundary. Re-verified for the Overview tab specifically this session with a jsdom XSS probe (malicious swimmer name + competition string) — confirmed no script execution, confirmed the payload renders as escaped text.

---

## localStorage Key Map

Unchanged from v2.4 — the Overview tab introduces **no new localStorage keys**. Its only state (chart-toggle exclusions, card expand/collapse, show-all/fewer, day cutoff, margin %) is session-only, held in module-level JS variables/`Set`s and DOM input values, not persisted.

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+ |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` / `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared by all coaches — not per-coach auth |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub | |

---

## FAB Speed Dial

Unchanged from v2.4 — 👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙/☀️ Theme.

---

## Testing

`test_overview.js` (not part of the shipped dashboard — a dev-time harness) runs the real extracted `<script>` block under jsdom, seeded with the actual project sample data files (`swimmers_pb.json`, `county_qt.json`, `regional_qt.json`). ~40+ checks covering: default tab state, tab-switch round-trips, card grouping, expand/collapse, show-all/fewer, chart-toggle math (arc angles, percentage recomputation), tie-break sort logic (with two real bugs in the test itself caught and fixed along the way — see `known-bugs-and-fixes.md`), the mobile digit-truncation fix, and an XSS probe. Run with `node test_overview.js` after extracting the `<script>` block; `node --check` on the extracted block is run after every edit, per the project's established convention since v1.0.
