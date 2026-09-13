# Coach Dashboard — Architecture (v2.7)

## Overview

Single HTML file (`index.html`, ~3,940 lines). No build step, no dependencies beyond the CDN-free vanilla JS in the page itself — including the Overview tab's charts, which are hand-rolled SVG/CSS rather than a charting library, to preserve that self-contained architecture. All state lives in `localStorage`. Logo is embedded as a base64 data URI. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal.

The Overview tab is the default tab on page load. County/Regional/editor tabs still render lazily on first switch to each.

**v2.7 in one paragraph:** a short, two-bug mobile follow-up session. Both bugs were real symptoms that had *looked* fixed in v2.6 but weren't fully closed — the gender-pill/squad-badge height mismatch (v2.6's shared `line-height` fix addressed the wrong CSS layer) and the Manage Data status message overlapping its own action buttons (v2.6's sticky-dock CSS was correct, but a DOM-ordering issue elsewhere in the same modal undermined it). No schema changes, no new features. See `known-bugs-and-fixes.md`'s "Fixed in v2.7" section for the full writeup, and `session-log.md` for the narrative. A separate, not-yet-implemented plan for importing official Swim England PB reports exists in `se-pb-import-and-history-plan.md` — nothing from it is reflected below, since none of it has been built.

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
    #tab-overview       Overview — "coach's morning briefing" (default active tab)
    #tab-county         County QT panel
    #tab-regional       Regional QT panel
    #tab-county-editor  County QT Editor (desktop only)
    #tab-regional-editor Regional QT Editor (desktop only)
  Modals (all four role="dialog" aria-modal="true" aria-labelledby, since v2.6):
    #dataModal        📤 Manage Data — one card per source (sync/upload/download/clear);
                       action buttons (Clear All Data / Close) now precede the status/error/
                       conflict dock in the markup (v2.7 — see "Manage Data Modal" section below)
    #syncModal        🔄 Sync from Google Sheets (token, merge mode, last-synced)
    #settingsModal     ⚙️ Settings (Apps Script URL + token)
    #addSwimmerModal   Add / Edit Swimmer
  FAB speed dial     ＋ → 👤 Add Swimmer / 📤 Manage Data / ⚙️ Settings / 🌙 Theme
                     (aria-label on every button, aria-expanded synced on the parent, since v2.6)
<script>
  1.  CONFIGURATION        GitHub QT sync URLs, Apps Script URL constant, ALL_EVENTS, avatar colours,
                           STROKE_ABBR / STROKE_COLOR
  2.  MODULE-LEVEL UTILS   STATUS_RANK, escAttr (onclick-attribute escaping),
                           kbActivate (keyboard activation for clickable-div UI)
  3.  DATA GLOBALS         SWIMMERS, COUNTY_QT, REGIONAL_QT, QT_META objects, parseQTFull,
                           lsGet, lsSet (write-side counterpart to lsGet),
                           warnStorageFailureOnce, migrateLegacyQTKey
  4.  UTILITIES            timeToSec, secToTime, fmtDate, fmtDateShort, fmtDateTime,
                           parseLocalDate, escHtml, initials, splitEventDistance
  5.  AGE BRACKETS         getSeasonYear, getCountyChampsDate/getRegionalChampsDate,
                           getCountyAgeBracket, getRegionalAgeBracket, getCurrentAge (plain
                           calendar age, independent of QT dates, used only by Squad Composition)
  6.  QT LOOKUP            lookupQT, calcStatus, sanitiseSwimmersData (also used by the
                           Sheets-sync path; validates pb.event/course/date too),
                           sanitiseQTData, describeSanitiseIssues / describeSanitiseQTIssues
  7.  DIAGNOSTIC           diagnoseZeroRowSwimmer — why a swimmer's card doesn't render (County/Regional tabs)
  8.  BUILD SWIMMER ROWS   buildSwimmerRows
  9.  PROGRESS BAR         buildProgressBar
  10. INFO BANNER          buildBanner, describeChampDates
  11. EVENT-LEVEL STATUS   getEventBestStatuses
  12. RENDER TAB           buildFooterNote, renderTab (shared), renderCounty, renderRegional,
                           debounce / debouncedRenderCounty / debouncedRenderRegional
                           (name-search input only; every other call site is unchanged)
  13. OVERVIEW TAB         See dedicated section below
  14. TAB SWITCHING        showTab, toggleCollapseAll, toggleSwimmer, updateCollapseBtnVisibility
  15. THEME                toggleTheme, applyTheme
  16. DATA: LOAD/SAVE      showDataModal, sanitiseSwimmersData, applySwimmersUpload,
                           applyQTUpload, resolveDataConflict, downloadSwimmers, clearData,
                           refreshStatusDockVisibility (see Manage Data section)
  17. LOCALSTORAGE GUARD   checkLocalStorageSize (alerts the coach once per session, not
                           just console.warn)
  18. ADD SWIMMER          showAddSwimmerModal, addPBRow
  19. EDIT/DELETE SWIMMER  editSwimmer, deleteSwimmer, saveSwimmer
  20. QT EDITOR (SAVE/META/TABLE/ADD ROW/DOWNLOAD)  saveQTToStorage (returns
                           success/failure), toggleMetaEdit, saveMetaEdit, updateMetaDisplay,
                           renderQTEditor, saveQTEdit, deleteQTRow, addQTRow, saveNewQTRow,
                           downloadQTData
  21. FAB                  toggleFab, openFab, closeFab (aria-expanded sync),
                           fabToggleTheme, fabShowDataModal, ...
  22. MODAL A11Y           openModalA11y, closeModalA11y, getFocusableIn, trapModalTab
  23. KEYBOARD              ESC handler (also handles Tab-trapping via trapModalTab)
  24. LOGO DATA URI         const LOGO_DATA_URI (base64)
  25. INIT                  DOMContentLoaded — logo, theme, restore last-sync display,
                           restore Overview day-cutoff/margin% preferences, renderOverview()
  26. GOOGLE SHEETS SYNC    startSync (sanitises before merging, checks save success),
                           mergeSwimmers, mergePbs, showSyncModal, showSettingsModal
  27. RETRY HELPER         fetchWithRetry — used by syncQTFromGitHub
```

---

## Overview Tab

A squad-wide, **unfiltered** "coach's morning briefing" — no Squad/Gender filter bar of its own, deliberately, since it's meant to be a single glance at the whole squad rather than another filterable list like County/Regional. Three sections, in this order: **Squad Composition** (top), **Hot Right Now**, **The Bubble List**.

### Shared building blocks

- **`getOverviewEligibleSwimmers()`** — the default exclusion gate (no `hidden`, not `'Former Swimmer'`) used by every section except where a section has its own explicit override (see Bubble List below).
- **`hiddenReasonDetail(sw)`** — short label + full tooltip for a swimmer excluded by a default gate (`Hidden` / `Former`), used when a section chooses to include them anyway.
- **`splitEventDistance(event)`** + **`STROKE_ABBR`** + **`STROKE_COLOR`** — splits an `ALL_EVENTS` string ("50 Free") into `{distance, stroke}`; maps stroke to a 2–3 letter mobile abbreviation (via the dashboard's existing `.col-full`/`.col-abbr` responsive-text pattern) and to a left-accent-bar color, reusing hex values already established elsewhere in the app (squad/gender colors) rather than a new palette.
- **`renderPersonCard(name, idx, entries, renderEntry, hideReason, expandedSet, toggleFnName)`** — the shared per-swimmer card used by both Hot Right Now and The Bubble List. Shows only `entries[0]` by default (the caller is responsible for pre-sorting entries so the most relevant one is first); a `▾ +N more` button reveals the rest via the passed-in `expandedSet` (a `Set` of expanded swimmer names) and `toggleFnName`. Cards get an `.expanded` class (light-blue background tint, `--accent`-tinted border) while open.
- **Per-entry two-column row** (`.ov-entry-stat`): a small muted "context" block on the left (what was swum), a grouped "result" block on the right (a bold hero stat with a smaller caption directly beneath it). A colored left accent bar (via `STROKE_COLOR`) ties the two columns together visually. The course badge inside this block (`e.course`) is escaped via `escHtml()` in both Hot Right Now and Bubble List — in Hot Right Now this closed a real stored-XSS gap found in v2.6; in Bubble List it was already safe by construction but is kept consistent with the rest of the file.
- **Section-level card cap**: both Hot Right Now and The Bubble List cap at `HOT_CARD_CAP`/`BUBBLE_CARD_CAP` (10 each — 2 full rows of 5 on desktop). A `hotShowAll`/`bubbleShowAll` boolean (independent of the per-card expand state) plus `toggleHotShowAll()`/`toggleBubbleShowAll()` let a "▾ Show all" / "▴ Show fewer" link on the capped-count note reveal or re-collapse the full list.

### Section 1 — Squad Composition

Three matching interactive pie/donut cards (`renderCompChart(chartId, title, items)`, shared by all three): **By Gender**, **By Squad**, **By Age**. Each card's legend sits to the right of its chart and is clickable — `toggleCompChartKey(chartId, key)` toggles a key in/out of `compChartExcluded[chartId]` (a per-chart `Set`, session-only), and the remaining slices' percentages recompute against whatever's still visible (not the original grand total), with the center total updating to match. A chart with more than 6 legend items (in practice, Age) automatically gets a 2-column legend (`.multi-col`) instead of a scrollable single column.

Legend items carry `role="button" tabindex="0" aria-pressed` and respond to Enter/Space via the shared `kbActivate()` handler.

Age is bucketed by **plain calendar age today** (`getCurrentAge`), not the County/Regional QT age bracket — those only exist once QT metadata (championship dates) is loaded and differ from each other, which would make this section unusable with no QT data loaded at all.

A small transparency note (`renderOverviewExclusionNote`) beneath Composition states how many Former/hidden swimmers aren't counted above.

### Section 2 — Hot Right Now

`collectRecentPbs(limit, cutoffDate)` → `groupRecentPbsBySwimmer()` → `renderHotList()`. PBs with no recorded `date` are excluded (undated entries can't be placed in a chronological feed). A configurable day cutoff (`#hotCutoffDays`, default 30 — `getHotCutoffDays()`/`getHotCutoffDate()`) filters the pool before grouping; the empty state distinguishes "nothing recorded, ever" from "nothing in this particular window" (the latter nudges the coach to widen the window). This cutoff value is persisted to `localStorage` (`coach_HOT_CUTOFF_DAYS`) and restored on page load, if within its valid range.

Ordering: most-recent-PB-date first, then **most PBs on/around that date** (not name) as the tiebreak — a plain date-only sort degenerates to alphabetical whenever several swimmers share a gala date, which is the normal case, not the exception.

The raw pool size before grouping is capped at `HOT_RAW_POOL_CAP` (documented in v2.6 — was a bare `200` inline before; same value, now with a comment flagging it as a real, if unlikely, silent-truncation point for a very large/long-history squad).

**Security note (still relevant):** `collectRecentPbs()` reads `sw.pbs` **directly**, not through `buildSwimmerRows()`'s `ALL_EVENTS`/`'S'|'L'`-constrained lookup path — meaning, unlike County/Regional/Bubble List, this section is not safe-by-construction against a bad `pb.event`/`pb.course` value. A real stored-XSS vulnerability was found and fixed here in v2.6 (unescaped `pb.course` in a `class` attribute) — see `known-bugs-and-fixes.md`. Any future change to this function should keep in mind that it's the one place in the app that doesn't get the "safe by construction" property for free. **This is directly relevant to the planned SE PB import (`se-pb-import-and-history-plan.md`)** — whatever code eventually writes SE-sourced PBs into `sw.pbs` must produce data that already satisfies `sanitiseSwimmersData()`'s existing `pb.event`/`pb.course`/`pb.date` checks, or extend them, rather than assuming a new import path is automatically safe.

### Section 3 — The Bubble List

`buildBubbleList(marginPercent, includeHidden)` → `groupBubbleEntriesBySwimmer()` → `renderBubbleList()`. Swimmers with a real, recorded PB within a configurable `%` margin (`#bubbleMargin`, default 5) of a County or Regional QT they haven't yet hit (`status` is `Consideration` or `Outside`, `gapQ > 0`). An "Include hidden / Former Swimmers" checkbox (`#bubbleIncludeHidden`) overrides `getOverviewEligibleSwimmers()` with the full `SWIMMERS` array when checked, tagging each included swimmer with `hiddenReasonDetail()`. The margin% value is persisted to `localStorage` (`coach_BUBBLE_MARGIN`) and restored on page load, if within its valid range.

Sort: smallest gap % first (a swimmer's own entries are naturally gap-ascending as a consequence of `buildBubbleList`'s global sort — see inline comment), tiebroken by most bubble opportunities (not name).

Displayed stat: the actual **time difference in seconds and the QT cutoff itself** ("0.12s off" / "QT 2:24.00"). No leading `+` sign. Meta line is two rows — championship type (County/Regional) on top, event + course underneath.

Unlike Hot Right Now, this section's `e.event`/`e.course` originate from `buildSwimmerRows()`'s constrained lookup and are safe by construction — the `escHtml(e.course)` here is consistency/defense-in-depth, not a fix for an exploitable path.

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

The Overview tab's stroke/squad/gender accent colors (`STROKE_COLOR`, `SQUAD_COLORS`, `GENDER_COLORS`) are plain JS hex constants, not CSS variables — deliberately reusing values already established elsewhere (squad badges, gender pills) rather than introducing a parallel palette.

`[role="button"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` — a single global rule giving every keyboard-accessible "clickable div" (swimmer headers, stat cards, chart legend items) a clear, on-brand focus ring instead of relying on the browser's inconsistent default outline.

### Fixed-height pill pattern (`.squad-badge`, `.gender-pill-mobile`) — rewritten in v2.7

Both now share the same layout strategy: an explicit `height: 19px` plus `display: inline-flex; align-items: center; justify-content: center`, rather than the v2.6 approach of matching `line-height` between the two. **Why the change:** `line-height` only constrains the line box a glyph sits in; it does not stop the glyph's own rendered ink from visually overflowing that box, which is exactly what the ♀/♂ characters could still do on some mobile rendering paths even with byte-for-byte identical `line-height` on both elements. A fixed `height` with flex-centering removes the box height from the glyph's control entirely — whatever the glyph's own metrics are, the box itself cannot grow or shrink.

Paired with this: the ♂/♀ HTML entities emitted in the swimmer meta line now carry the Unicode **text-presentation variation selector** (U+FE0E) immediately after them — `&#9794;&#xFE0E;` (male) / `&#9792;&#xFE0E;` (female) — which explicitly requests the plain monochrome text glyph rather than any colour/emoji presentation a platform might otherwise substitute for these particular code points. Either fix alone should be sufficient; both are applied as belt-and-braces given this is the second time this exact symptom has been reported.

The mobile media-query rule that toggles the pill's visibility changed from `.gender-pill-mobile { display: inline-block !important; }` to `display: inline-flex !important` — `inline-block` would have silently dropped the new flex-centering on the one viewport where the pill actually renders.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤500 px (mobile) | Header tagline drops to its own row; Overview tab takes the full first row, County/Regional pair up on row 2; tabs wrap; stat cards compact; filter bar becomes grid; progress column hidden; gender pill (now inline-flex, see above); squad badges match its height exactly; QT editor tabs hidden; Overview card grids go 2-up; stroke names abbreviate (FR/BK/BR/FLY/IM); the course badge inside Overview entry rows shrinks correctly; Manage Data's status/error/conflict messages dock sticky to the bottom of the modal once they have something to show, and — **as of v2.7** — that dock is the true last child of the modal so nothing renders underneath it to be overlapped |
| >500 px (desktop) | Full layout; QT editor tabs visible; Overview card grids go 5-up; Manage Data status area behaves exactly as before (no sticky dock — never needed one, taller viewport) |

---

## Data Flow

```
localStorage
  ↓ parseQTFull() / lsGet()  (+ migrateLegacyQTKey() one-time migration)
COUNTY_QT (array) + COUNTY_QT_META (object)
REGIONAL_QT (array) + REGIONAL_QT_META (object)
SWIMMERS (array)
  ↓
renderOverview()                        — called on load and after every data-changing action
  → renderComposition()                 — 3 pie/donut cards, session-only toggle state
  → renderHotList()                     — card grid, session-only expand + show-all state
                                           (day-cutoff persisted)
  → renderBubbleList()                  — card grid, session-only expand + show-all state
                                           (margin% persisted)
  → renderOverviewExclusionNote()

renderTab(prefix)                       — County/Regional
  → visibleSwimmers = SWIMMERS filtered by hidden/Former-gate/squad/gender/age/name
  → buildSwimmerRows(swimmer, qtData, ageFn, ...) per visible swimmer
      → lookupQT → calcStatus
      → if zero rows: diagnoseZeroRowSwimmer()
  → getEventBestStatuses(rows)
  → renderStatCards / swimmer card template / buildProgressBar
  → buildFooterNote(...)

Data-entry paths, all validated + write-checked:
  applySwimmersUpload / startSync  → sanitiseSwimmersData()  → lsSet('coach_SWIMMERS', ...)
  applyQTUpload / syncQTFromGitHub → sanitiseQTData()        → saveQTToStorage() → lsSet(...)
```

### QT Storage

```
coach_COUNTY_QT_FULL   = { meta: {title, dateFrom, dateTo}, times: [...] }
coach_REGIONAL_QT_FULL = { meta: {title, dateFrom, dateTo}, times: [...] }
```

`parseQTFull()` accepts both this format and the legacy plain-array format. The legacy-format keys (`coach_COUNTY_QT`/`coach_REGIONAL_QT`) are no longer read as a permanent fallback — `migrateLegacyQTKey()` runs once at startup and, if only the legacy key has data, writes it into the new key and deletes the legacy key. No stored-data shape changes otherwise.

---

## Key Business Logic

### Age bracket calculation

Championship dates are **not hardcoded** — `getCountyChampsDate()`/`getRegionalChampsDate()` read `QT_META.dateTo`, falling back to `dateFrom`, returning `''` if neither is set. Used by County/Regional tabs and their age brackets. The Overview tab's Squad Composition deliberately does **not** use this — see "Section 1" above.

### Status precedence

`STATUS_RANK`: `Qualified(0) > Consideration(1) > Outside(2) > No PB(3) > No Data(4)`.

### Inverted QT data guard

`calcStatus` and `buildProgressBar` normalise `qualify`/`consider` via `Math.min`/`Math.max`.

### "Not shown" diagnostic (County/Regional tabs only)

`diagnoseZeroRowSwimmer`/`buildFooterNote`. Not reused by the Overview tab, which has its own simpler exclusion-note pattern (see Section 1).

---

## Security Notes

### The v2.6 stored-XSS finding, in full (unchanged this session, restated for context)

Hot Right Now's `collectRecentPbs()` reads `sw.pbs` directly rather than going through `buildSwimmerRows()`'s `ALL_EVENTS`/`'S'|'L'`-constrained lookup path — the path every other tab uses, which makes whatever's in `r.event`/`r.course` safe by construction regardless of the raw data. Hot Right Now had no equivalent guarantee, and rendered `e.course` **completely unescaped** inside `class="badge ${e.course}"`. At the same time, `sanitiseSwimmersData()` validated `pb.time` but not `pb.event`/`pb.course` at all. A manually-uploaded swimmers file (or a compromised/malformed Google Sheet row) with a crafted `course` value like `"><img src=x onerror="...">` could break out of that attribute — a genuine injection point on the default landing tab.

**Fixed at two layers:**
1. **Root cause** — `sanitiseSwimmersData()` now validates `pb.event` against `ALL_EVENTS` and `pb.course` against `'S'`/`'L'`, dropping the PB entirely if either is invalid.
2. **Defense-in-depth** — both occurrences of `e.course` (Hot Right Now and, for consistency, Bubble List) are wrapped in `escHtml()` at render time, so even a future code path that bypassed the sanitiser wouldn't be exploitable.

**Forward-looking note:** the planned SE PB report import (`se-pb-import-and-history-plan.md`) will introduce a *new* code path that writes into `sw.pbs`. Whatever that code turns out to be, it must run its parsed rows through `sanitiseSwimmersData()` (or an equivalent that enforces the same `pb.event`/`pb.course`/`pb.date` constraints) before persisting — the safety property here comes from validation at the point of entry, not from where the data happened to originate.

### Escaping conventions (unchanged)

- **`escAttr()`** — double-layer escape (JS-string then HTML-attribute) for values embedded in `onclick="fn('${value}')"`.
- **`escHtml()`** — plain HTML text/attribute escaping for everything else.
- Rendering-side escaping remains the actual security boundary for anything that reaches the DOM — validation closes data-quality gaps and, in the Hot Right Now case above, closed an actual injection point at its source too.

### Validation, symmetric across upload and sync (unchanged since v2.6)

- `sanitiseSwimmersData()` is called from `startSync()` too, before `mergeSwimmers()`.
- `sanitiseQTData()` validates `gender`/`course`/`event`/`age`/`qualify`/`consider`, used by both `applyQTUpload()` and `syncQTFromGitHub()`.

### Write-side localStorage protection (unchanged since v2.6)

Every `localStorage.setItem()` call goes through `lsSet()`; every call site checks its return value. Where a dedicated status UI exists, failure is reported there; otherwise `warnStorageFailureOnce()` alerts the coach once per page load.

### Apps Script hardening (unchanged since v2.6)

`safeCompare()` for the token check; `setToken()` guarded against accidental overwrite. See `apps_script_v2.2.2.gs`.

### Accessibility (unchanged since v2.6)

Viewport allows pinch-zoom; every mouse-only "clickable div" has `role="button" tabindex="0"` and responds to Enter/Space via `kbActivate(event)`; all four modals have `role="dialog" aria-modal="true" aria-labelledby="<id>"` with focus trap/restore (`openModalA11y`/`closeModalA11y`/`trapModalTab`/`getFocusableIn`); FAB buttons have `aria-label` and a synced `aria-expanded`.

---

## Manage Data Modal — Mobile Status Dock (v2.6, DOM order corrected in v2.7)

**v2.6 background:** on mobile, `dataStatus`/`dataError`/`dataConflictBox` sat in normal document flow below three data-cards, so an upload-triggered merge conflict or sync error could go completely unnoticed unless the coach scrolled down afterward. **Fix (v2.6):** the three elements were wrapped in `#dataModalStatusDock`. `refreshStatusDockVisibility()` — called from `setDataStatus()`, `clearDataStatus()`, `setDataError()`, `showDataConflict()`, and `cancelDataConflict()` — toggles a `dock-visible` class on the wrapper based on whether any of the three is actually showing. Only when that class is present does the mobile-only CSS make the dock `position: sticky; bottom: -20px; margin: 10px -20px -20px; ...` — bleeding it flush to the modal's own edges.

**The v2.7 bug:** that CSS implicitly assumed the dock was the *last* element in the modal (nothing else needed to render below it). It wasn't — the Clear All Data / Close button row followed it in the markup. The dock's negative bottom margin pulled that row up into the dock's own painted area, so an appearing status message visually overlapped both buttons.

**The v2.7 fix:** reordered the markup — the Clear All Data / Close row now precedes `#dataModalStatusDock`, which is the true last child of `.modal-box`. No CSS change was needed; the sticky-bottom behaviour was already correct, it just needed nothing left underneath it to cover.

Desktop CSS is completely untouched throughout (no sticky dock there — never needed one, taller viewport).

---

## localStorage Key Map

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative. Every write goes through `lsSet()` and its result is checked |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | `saveQTToStorage()` returns success/failure |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | Same as above |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Plain array | *(legacy)* | `migrateLegacyQTKey()` completes the migration on next load instead of reading this forever |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` / `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared by all coaches — not per-coach auth (accepted trade-off, see `project-brief.md`) |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub | |
| `coach_HOT_CUTOFF_DAYS` | string (integer) | Hot Right Now's cutoff input | Restored on load if in range 1–365 |
| `coach_BUBBLE_MARGIN` | string (float) | Bubble List's margin input | Restored on load if in range 0.1–20 |

Everything else about the Overview tab's session state (chart-toggle exclusions, per-card expand/collapse, show-all/fewer) remains intentionally session-only — matching how `collapseAllState` already behaves for County/Regional.

**Not yet added, planned:** an `se` field (`SE#`) on the swimmer record and a per-PB `source` field (`gala`/`se`/`manual`) — see `se-pb-import-and-history-plan.md`. Neither exists in the current schema; `data-schema.md` documents them separately as planned, not current.

---

## FAB Speed Dial

👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙/☀️ Theme. Every button has `aria-label`; the parent's `aria-expanded` tracks open/closed state.

---

## Retry Logic

`fetchWithRetry(url, options, maxAttempts, onRetry)` — used only by `syncQTFromGitHub()`. Retries network-level failures (fetch throwing, e.g. briefly offline) and HTTP 5xx responses with a short linear backoff (`600ms × attempt`), up to `maxAttempts` total tries; a 4xx response (e.g. a renamed/missing file) is returned immediately without retrying, since that's a configuration problem retrying won't fix. `onRetry(attempt, maxAttempts)` lets the caller update its status message between attempts ("retry 1/2", etc). Does not cover genuinely extended offline periods — see `known-bugs-and-fixes.md` Open Issue #4.

---

## Testing

`test_overview.js` (not part of the shipped dashboard — a dev-time harness) runs the real extracted `<script>` block under jsdom, seeded with the actual project sample data files (`swimmers_pb.json`, `county_qt.json`, `regional_qt.json`). ~40+ checks covering: default tab state, tab-switch round-trips, card grouping, expand/collapse, show-all/fewer, chart-toggle math, tie-break sort logic, the mobile digit-truncation fix, and an XSS probe. **Unchanged in v2.7** — neither v2.7 fix touches anything this suite already asserts on, so it wasn't re-run as part of that session; it should still be re-confirmed the next time a change touches the Overview tab or Manage Data modal broadly.

**v2.7 used a small, separate one-off jsdom probe** (`probe_fixes.js`, not added to the permanent suite) written specifically to verify the two v2.7 fixes: `getComputedStyle` equality between `.squad-badge` and `.gender-pill-mobile` (height, `align-items`, `justify-content`), a source-string check for the U+FE0E selector, and a DOM-order assertion (`modalBox.lastElementChild === statusDock`, button row precedes the dock). This follows the same "write a probe that proves the actual property you care about" convention established in v2.6 for security/accessibility fixes — extended here to a plain CSS/DOM-structure bug, since "markup exists" or "CSS rule exists" doesn't prove a visual bug is actually gone; a computed-style/DOM-order assertion does.

**Reminder for any future session reconstructing `index.html` locally for testing:** the embedded base64 logo is large; if it gets stubbed with a placeholder to make local iteration easier, the real logo **must** be restored (and the fix re-verified afterward) before the file is considered final. This happened correctly in v2.7 but is worth calling out as a standing risk for any similar future session.
