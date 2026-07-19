# Coach Dashboard — Architecture (v2.6)

## Overview

Single HTML file (`index.html`, ~3,910 lines). No build step, no dependencies beyond the CDN-free vanilla JS in the page itself — including the Overview tab's charts, which are hand-rolled SVG/CSS rather than a charting library, to preserve that self-contained architecture. All state lives in `localStorage`. Logo is embedded as a base64 data URI. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal.

The Overview tab is the default tab on page load. County/Regional/editor tabs still render lazily on first switch to each.

**v2.6 in one paragraph:** no new features, no schema changes. A security/accessibility/code-quality hardening pass — every `localStorage` write now checked for failure, sync-path data validated the same as manual uploads, QT data validated for the first time on either path, a real stored-XSS finding fixed, and keyboard/screen-reader support added to UI that was previously mouse/touch-only. See `known-bugs-and-fixes.md`'s "Fixed in v2.6" section for the full itemised list, and `session-log.md` for the turn-by-turn narrative.

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
  Modals (all four now role="dialog" aria-modal="true" aria-labelledby, v2.6):
    #dataModal        📤 Manage Data — one card per source (sync/upload/download/clear);
                       status/error/conflict area is a mobile-sticky dock, v2.6 (see below)
    #syncModal        🔄 Sync from Google Sheets (token, merge mode, last-synced)
    #settingsModal     ⚙️ Settings (Apps Script URL + token)
    #addSwimmerModal   Add / Edit Swimmer
  FAB speed dial     ＋ → 👤 Add Swimmer / 📤 Manage Data / ⚙️ Settings / 🌙 Theme
                     (v2.6: aria-label on every button, aria-expanded synced on the parent)
<script>
  1.  CONFIGURATION        GitHub QT sync URLs, Apps Script URL constant, ALL_EVENTS, avatar colours,
                           STROKE_ABBR / STROKE_COLOR
  2.  MODULE-LEVEL UTILS   STATUS_RANK, escAttr (onclick-attribute escaping),
                           kbActivate (v2.6 — keyboard activation for clickable-div UI)
  3.  DATA GLOBALS         SWIMMERS, COUNTY_QT, REGIONAL_QT, QT_META objects, parseQTFull,
                           lsGet, lsSet (v2.6 — write-side counterpart to lsGet),
                           warnStorageFailureOnce (v2.6), migrateLegacyQTKey (v2.6)
  4.  UTILITIES            timeToSec, secToTime, fmtDate, fmtDateShort, fmtDateTime,
                           parseLocalDate, escHtml, initials, splitEventDistance
  5.  AGE BRACKETS         getSeasonYear, getCountyChampsDate/getRegionalChampsDate,
                           getCountyAgeBracket, getRegionalAgeBracket, getCurrentAge (plain
                           calendar age, independent of QT dates, used only by Squad Composition)
  6.  QT LOOKUP            lookupQT, calcStatus, sanitiseSwimmersData (v2.6: now also used by
                           the Sheets-sync path, validates pb.event/course/date too),
                           sanitiseQTData (v2.6, new), describeSanitiseIssues /
                           describeSanitiseQTIssues (v2.6, new)
  7.  DIAGNOSTIC           diagnoseZeroRowSwimmer — why a swimmer's card doesn't render (County/Regional tabs)
  8.  BUILD SWIMMER ROWS   buildSwimmerRows
  9.  PROGRESS BAR         buildProgressBar
  10. INFO BANNER          buildBanner, describeChampDates
  11. EVENT-LEVEL STATUS   getEventBestStatuses
  12. RENDER TAB           buildFooterNote, renderTab (shared), renderCounty, renderRegional,
                           debounce / debouncedRenderCounty / debouncedRenderRegional (v2.6 —
                           name-search input only; every other call site is unchanged)
  13. OVERVIEW TAB         See dedicated section below
  14. TAB SWITCHING        showTab, toggleCollapseAll, toggleSwimmer, updateCollapseBtnVisibility
  15. THEME                toggleTheme, applyTheme
  16. DATA: LOAD/SAVE      showDataModal, sanitiseSwimmersData, applySwimmersUpload,
                           applyQTUpload, resolveDataConflict, downloadSwimmers, clearData,
                           refreshStatusDockVisibility (v2.6, new — see Manage Data section)
  17. LOCALSTORAGE GUARD   checkLocalStorageSize (v2.6: now also alerts the coach once per
                           session, not just console.warn)
  18. ADD SWIMMER          showAddSwimmerModal, addPBRow
  19. EDIT/DELETE SWIMMER  editSwimmer, deleteSwimmer, saveSwimmer
  20. QT EDITOR (SAVE/META/TABLE/ADD ROW/DOWNLOAD)  saveQTToStorage (v2.6: now returns
                           success/failure), toggleMetaEdit, saveMetaEdit, updateMetaDisplay,
                           renderQTEditor, saveQTEdit, deleteQTRow, addQTRow, saveNewQTRow,
                           downloadQTData
  21. FAB                  toggleFab, openFab, closeFab (v2.6: aria-expanded sync),
                           fabToggleTheme, fabShowDataModal, ...
  22. MODAL A11Y (v2.6)    openModalA11y, closeModalA11y, getFocusableIn, trapModalTab
  23. KEYBOARD              ESC handler (now also handles Tab-trapping via trapModalTab, v2.6)
  24. LOGO DATA URI         const LOGO_DATA_URI (base64)
  25. INIT                  DOMContentLoaded — logo, theme, restore last-sync display,
                           restore Overview day-cutoff/margin% preferences (v2.6), renderOverview()
  26. GOOGLE SHEETS SYNC    startSync (v2.6: now sanitises before merging, checks save success),
                           mergeSwimmers, mergePbs, showSyncModal, showSettingsModal
  27. RETRY HELPER (v2.6)   fetchWithRetry — used by syncQTFromGitHub
```

---

## Overview Tab

A squad-wide, **unfiltered** "coach's morning briefing" — no Squad/Gender filter bar of its own, deliberately, since it's meant to be a single glance at the whole squad rather than another filterable list like County/Regional. Three sections, in this order: **Squad Composition** (top), **Hot Right Now**, **The Bubble List**.

### Shared building blocks

- **`getOverviewEligibleSwimmers()`** — the default exclusion gate (no `hidden`, not `'Former Swimmer'`) used by every section except where a section has its own explicit override (see Bubble List below).
- **`hiddenReasonDetail(sw)`** — short label + full tooltip for a swimmer excluded by a default gate (`Hidden` / `Former`), used when a section chooses to include them anyway.
- **`splitEventDistance(event)`** + **`STROKE_ABBR`** + **`STROKE_COLOR`** — splits an `ALL_EVENTS` string ("50 Free") into `{distance, stroke}`; maps stroke to a 2–3 letter mobile abbreviation (via the dashboard's existing `.col-full`/`.col-abbr` responsive-text pattern) and to a left-accent-bar color, reusing hex values already established elsewhere in the app (squad/gender colors) rather than a new palette.
- **`renderPersonCard(name, idx, entries, renderEntry, hideReason, expandedSet, toggleFnName)`** — the shared per-swimmer card used by both Hot Right Now and The Bubble List. Shows only `entries[0]` by default (the caller is responsible for pre-sorting entries so the most relevant one is first); a `▾ +N more` button reveals the rest via the passed-in `expandedSet` (a `Set` of expanded swimmer names) and `toggleFnName`. Cards get an `.expanded` class (light-blue background tint, `--accent`-tinted border) while open.
- **Per-entry two-column row** (`.ov-entry-stat`): a small muted "context" block on the left (what was swum), a grouped "result" block on the right (a bold hero stat with a smaller caption directly beneath it). A colored left accent bar (via `STROKE_COLOR`) ties the two columns together visually. **v2.6:** the course badge inside this block (`e.course`) is now escaped via `escHtml()` in both Hot Right Now and Bubble List — in Hot Right Now this closed a real stored-XSS gap (see Security section below); in Bubble List it was already safe by construction but is now consistent with the rest of the file.
- **Section-level card cap**: both Hot Right Now and The Bubble List cap at `HOT_CARD_CAP`/`BUBBLE_CARD_CAP` (10 each — 2 full rows of 5 on desktop). A `hotShowAll`/`bubbleShowAll` boolean (independent of the per-card expand state) plus `toggleHotShowAll()`/`toggleBubbleShowAll()` let a "▾ Show all" / "▴ Show fewer" link on the capped-count note reveal or re-collapse the full list.

### Section 1 — Squad Composition

Three matching interactive pie/donut cards (`renderCompChart(chartId, title, items)`, shared by all three): **By Gender**, **By Squad**, **By Age**. Each card's legend sits to the right of its chart and is clickable — `toggleCompChartKey(chartId, key)` toggles a key in/out of `compChartExcluded[chartId]` (a per-chart `Set`, session-only), and the remaining slices' percentages recompute against whatever's still visible (not the original grand total), with the center total updating to match. A chart with more than 6 legend items (in practice, Age) automatically gets a 2-column legend (`.multi-col`) instead of a scrollable single column.

**v2.6:** legend items now carry `role="button" tabindex="0" aria-pressed` and respond to Enter/Space via the shared `kbActivate()` handler — previously mouse/touch-only.

Age is bucketed by **plain calendar age today** (`getCurrentAge`), not the County/Regional QT age bracket — those only exist once QT metadata (championship dates) is loaded and differ from each other, which would make this section unusable with no QT data loaded at all.

A small transparency note (`renderOverviewExclusionNote`) beneath Composition states how many Former/hidden swimmers aren't counted above.

### Section 2 — Hot Right Now

`collectRecentPbs(limit, cutoffDate)` → `groupRecentPbsBySwimmer()` → `renderHotList()`. PBs with no recorded `date` are excluded (undated entries can't be placed in a chronological feed). A configurable day cutoff (`#hotCutoffDays`, default 30 — `getHotCutoffDays()`/`getHotCutoffDate()`) filters the pool before grouping; the empty state distinguishes "nothing recorded, ever" from "nothing in this particular window" (the latter nudges the coach to widen the window). **v2.6:** this cutoff value is now persisted to `localStorage` (`coach_HOT_CUTOFF_DAYS`) and restored on page load, if within its valid range.

Ordering: most-recent-PB-date first, then **most PBs on/around that date** (not name) as the tiebreak — a plain date-only sort degenerates to alphabetical whenever several swimmers share a gala date, which is the normal case, not the exception.

The raw pool size before grouping is capped at `HOT_RAW_POOL_CAP` (**named/documented in v2.6** — was a bare `200` inline before; same value, now with a comment flagging it as a real, if unlikely, silent-truncation point for a very large/long-history squad).

**Security note (v2.6, important):** `collectRecentPbs()` reads `sw.pbs` **directly**, not through `buildSwimmerRows()`'s `ALL_EVENTS`/`'S'|'L'`-constrained lookup path — meaning, unlike County/Regional/Bubble List, this section is not safe-by-construction against a bad `pb.event`/`pb.course` value. A real stored-XSS vulnerability was found and fixed here this session (unescaped `pb.course` in a `class` attribute) — see the Security section further down for the full writeup. Any future change to this function should keep in mind that it's the one place in the app that doesn't get the "safe by construction" property for free.

### Section 3 — The Bubble List

`buildBubbleList(marginPercent, includeHidden)` → `groupBubbleEntriesBySwimmer()` → `renderBubbleList()`. Swimmers with a real, recorded PB within a configurable `%` margin (`#bubbleMargin`, default 5) of a County or Regional QT they haven't yet hit (`status` is `Consideration` or `Outside`, `gapQ > 0`). An "Include hidden / Former Swimmers" checkbox (`#bubbleIncludeHidden`) overrides `getOverviewEligibleSwimmers()` with the full `SWIMMERS` array when checked, tagging each included swimmer with `hiddenReasonDetail()`. **v2.6:** the margin% value is now persisted to `localStorage` (`coach_BUBBLE_MARGIN`) and restored on page load, if within its valid range.

Sort: smallest gap % first (a swimmer's own entries are naturally gap-ascending as a consequence of `buildBubbleList`'s global sort — see inline comment), tiebroken by most bubble opportunities (not name).

Displayed stat: the actual **time difference in seconds and the QT cutoff itself** ("0.12s off" / "QT 2:24.00"). No leading `+` sign. Meta line is two rows — championship type (County/Regional) on top, event + course underneath.

Unlike Hot Right Now, this section's `e.event`/`e.course` originate from `buildSwimmerRows()`'s constrained lookup and are safe by construction — the `escHtml(e.course)` added here in v2.6 is consistency/defense-in-depth, not a fix for an exploitable path.

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

**v2.6 addition:** `[role="button"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` — a single global rule giving every newly-keyboard-accessible "clickable div" (swimmer headers, stat cards, chart legend items) a clear, on-brand focus ring instead of relying on the browser's inconsistent default outline.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤500 px (mobile) | Header tagline drops to its own row; Overview tab takes the full first row, County/Regional pair up on row 2; tabs wrap; stat cards compact; filter bar becomes grid; progress column hidden; gender pill; swimmer badges stack; QT editor tabs hidden; Overview card grids go 2-up; stroke names abbreviate (FR/BK/BR/FLY/IM); **(v2.6)** gender-pill/squad-badge share a fixed line-height so they render the same height; **(v2.6)** the course badge inside Overview entry rows actually shrinks now (previously blocked by a selector-specificity bug); **(v2.6)** Manage Data's status/error/conflict messages dock sticky to the bottom of the modal once they have something to show |
| >500 px (desktop) | Full layout; QT editor tabs visible; Overview card grids go 5-up; Manage Data status area behaves exactly as before v2.6 (no sticky dock — never needed one, taller viewport) |

---

## Data Flow

```
localStorage
  ↓ parseQTFull() / lsGet()  (+ migrateLegacyQTKey() one-time migration, v2.6)
COUNTY_QT (array) + COUNTY_QT_META (object)
REGIONAL_QT (array) + REGIONAL_QT_META (object)
SWIMMERS (array)
  ↓
renderOverview()                        — called on load and after every data-changing action
  → renderComposition()                 — 3 pie/donut cards, session-only toggle state
  → renderHotList()                     — card grid, session-only expand + show-all state
                                           (day-cutoff persisted, v2.6)
  → renderBubbleList()                  — card grid, session-only expand + show-all state
                                           (margin% persisted, v2.6)
  → renderOverviewExclusionNote()

renderTab(prefix)                       — County/Regional
  → visibleSwimmers = SWIMMERS filtered by hidden/Former-gate/squad/gender/age/name
  → buildSwimmerRows(swimmer, qtData, ageFn, ...) per visible swimmer
      → lookupQT → calcStatus
      → if zero rows: diagnoseZeroRowSwimmer()
  → getEventBestStatuses(rows)
  → renderStatCards / swimmer card template / buildProgressBar
  → buildFooterNote(...)

Data-entry paths, all now validated + write-checked (v2.6):
  applySwimmersUpload / startSync  → sanitiseSwimmersData()  → lsSet('coach_SWIMMERS', ...)
  applyQTUpload / syncQTFromGitHub → sanitiseQTData()        → saveQTToStorage() → lsSet(...)
  (both sync paths previously skipped validation; both write paths previously skipped the
  success/failure check — see Security section below)
```

### QT Storage

```
coach_COUNTY_QT_FULL   = { meta: {title, dateFrom, dateTo}, times: [...] }
coach_REGIONAL_QT_FULL = { meta: {title, dateFrom, dateTo}, times: [...] }
```

`parseQTFull()` accepts both this format and the legacy plain-array format. **v2.6:** the legacy-format keys (`coach_COUNTY_QT`/`coach_REGIONAL_QT`) are no longer read as a permanent fallback forever — `migrateLegacyQTKey()` runs once at startup and, if only the legacy key has data, writes it into the new key and deletes the legacy key. No stored-data shape changes otherwise.

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

## Security Notes (v2.6 — substantially updated this session)

### The stored-XSS finding, in full

Hot Right Now's `collectRecentPbs()` reads `sw.pbs` directly rather than going through `buildSwimmerRows()`'s `ALL_EVENTS`/`'S'|'L'`-constrained lookup path — the path every other tab uses, which makes whatever's in `r.event`/`r.course` safe by construction regardless of the raw data. Hot Right Now had no equivalent guarantee, and rendered `e.course` **completely unescaped** inside `class="badge ${e.course}"`. At the same time, `sanitiseSwimmersData()` validated `pb.time` but not `pb.event`/`pb.course` at all. A manually-uploaded swimmers file (or a compromised/malformed Google Sheet row) with a crafted `course` value like `"><img src=x onerror="...">` could break out of that attribute — a genuine injection point on the default landing tab.

**Fixed at two layers:**
1. **Root cause** — `sanitiseSwimmersData()` now validates `pb.event` against `ALL_EVENTS` and `pb.course` against `'S'`/`'L'`, dropping the PB entirely if either is invalid.
2. **Defense-in-depth** — both occurrences of `e.course` (Hot Right Now and, for consistency, Bubble List) are now wrapped in `escHtml()` at render time, so even a future code path that bypassed the sanitiser wouldn't be exploitable.

Verified with a dedicated jsdom probe: the malicious payload is rejected by the sanitiser (PB dropped); when injected directly (bypassing the sanitiser, simulating a hypothetical future gap), it renders as inert escaped text with zero script execution and zero `<img>` elements actually created in the DOM.

### Escaping conventions (unchanged, restated)

- **`escAttr()`** — double-layer escape (JS-string then HTML-attribute) for values embedded in `onclick="fn('${value}')"`.
- **`escHtml()`** — plain HTML text/attribute escaping for everything else.
- Rendering-side escaping remains the actual security boundary for anything that reaches the DOM — validation (below) closes data-quality gaps and, in the Hot Right Now case above, closed an actual injection point at its source too.

### Validation, now symmetric across upload and sync (v2.6)

Previously, only the manual-upload path ran swimmer data through `sanitiseSwimmersData()` — Google Sheets sync went straight to `mergeSwimmers()` with zero validation, and QT data (upload OR sync) had no validation of any field at all. Both gaps are closed:

- `sanitiseSwimmersData()` is now called from `startSync()` too, before `mergeSwimmers()`. Apps Script's own `formatDob()`/date formatting already produce the exact shape this sanitiser expects, so there's no format-mismatch cost to doing this.
- `sanitiseQTData()` (new) validates `gender`/`course`/`event`/`age`/`qualify`/`consider`, used by both `applyQTUpload()` and `syncQTFromGitHub()`.

### Write-side localStorage protection (v2.6)

Every `localStorage.setItem()` call in the file was previously unwrapped — only reads (`lsGet()`) had try/catch. `lsSet()` is the write-side counterpart; every call site now checks its return value. Where a dedicated status UI exists (Manage Data modal, Sync modal), failure is reported there. Where none exists (e.g. an inline QT-editor cell save on blur, which can fire many times in quick succession), a shared `warnStorageFailureOnce()` alerts the coach once per page load rather than risking a wall of repeated popups during a broken-storage session.

### Apps Script hardening (v2.6)

- `doGet()`'s token check now uses `safeCompare()` (XORs every character rather than exiting on the first mismatch) instead of a plain `!==` — closes a theoretical timing side-channel. Very low real-world risk (single low-value target, not a public multi-tenant service) but cheap to fix.
- `setToken()` now refuses to overwrite an already-configured `ACCESS_TOKEN` unless called explicitly as `setToken(true)` — previously, re-running this "run once, then delete" helper (e.g. by accident, or by a future maintainer who didn't delete it) would silently reset the token to its placeholder value and lock out every coach's sync.
- File renamed `apps_script_v2.2.2.gs` for these two changes.

### Accessibility (v2.6, new — see also the dedicated CSS section above)

- Viewport meta no longer disables pinch-zoom (was a WCAG 1.4.4 failure).
- Every mouse-only "clickable div" (swimmer-card headers, stat cards, Overview chart legend items) now has `role="button" tabindex="0"` and responds to Enter/Space via the shared `kbActivate(event)` handler, which calls `event.currentTarget.click()` — i.e. it reuses the exact same `onclick` logic already wired on the element, rather than duplicating it.
- All four modals now have `role="dialog" aria-modal="true" aria-labelledby="<id>"`. `openModalA11y(id)` remembers `document.activeElement` before opening and focuses the first focusable element inside the modal (deferred via `setTimeout(0)` so it runs after the `.open` class has applied and the modal is actually visible/focusable); `closeModalA11y()` restores focus to whatever had it before. `trapModalTab(event)` — called from the existing document-level `keydown` listener whenever `event.key === 'Tab'` — keeps Tab/Shift+Tab cycling within whichever modal is currently open via `getFocusableIn()`.
- FAB buttons have `aria-label` in addition to `title` (screen readers don't reliably announce `title` alone); the parent FAB button's `aria-expanded` is kept in sync with `openFab()`/`closeFab()`.

---

## Manage Data Modal — Mobile Status Visibility (v2.6, follow-up fix)

Reported after the main review shipped: on mobile, `dataStatus`/`dataError`/`dataConflictBox` sat in normal document flow below three data-cards, so an upload-triggered merge conflict or a sync error could go completely unnoticed unless the coach scrolled down afterward. Desktop was unaffected (taller viewport).

**Fix:** the three elements are now wrapped in `#dataModalStatusDock`. `refreshStatusDockVisibility()` — called from `setDataStatus()`, `clearDataStatus()`, `setDataError()`, `showDataConflict()`, and `cancelDataConflict()` — toggles a `dock-visible` class on the wrapper based on whether any of the three is actually showing (`el.style.display === 'block'`). Only when that class is present does the mobile-only CSS make the dock `position: sticky; bottom: ...` with its own background/border/shadow — so there's never an empty floating bar with nothing in it. Desktop CSS is completely untouched.

---

## localStorage Key Map

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative. **v2.6:** every write goes through `lsSet()` and its result is checked |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | **v2.6:** `saveQTToStorage()` now returns success/failure |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | Same as above |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Plain array | *(legacy)* | **v2.6:** `migrateLegacyQTKey()` completes the migration on next load instead of reading this forever — see QT Storage section above |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` / `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared by all coaches — not per-coach auth (accepted trade-off, see `project-brief.md`) |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub | |
| `coach_HOT_CUTOFF_DAYS` | string (integer) | Hot Right Now's cutoff input | **New in v2.6.** Restored on load if in range 1–365 |
| `coach_BUBBLE_MARGIN` | string (float) | Bubble List's margin input | **New in v2.6.** Restored on load if in range 0.1–20 |

Everything else about the Overview tab's session state (chart-toggle exclusions, per-card expand/collapse, show-all/fewer) remains intentionally session-only — a deliberate choice, not a gap, matching how `collapseAllState` already behaves for County/Regional.

---

## FAB Speed Dial

👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙/☀️ Theme. **v2.6:** every button now has `aria-label`; the parent's `aria-expanded` tracks open/closed state.

---

## Retry Logic (v2.6, new)

`fetchWithRetry(url, options, maxAttempts, onRetry)` — used only by `syncQTFromGitHub()`. Retries network-level failures (fetch throwing, e.g. briefly offline) and HTTP 5xx responses with a short linear backoff (`600ms × attempt`), up to `maxAttempts` total tries; a 4xx response (e.g. a renamed/missing file) is returned immediately without retrying, since that's a configuration problem retrying won't fix. `onRetry(attempt, maxAttempts)` lets the caller update its status message between attempts ("retry 1/2", etc). Verified against a mocked flaky `fetch` covering all three branches (eventual success, immediate 4xx, exhausted retries).

---

## Testing

`test_overview.js` (not part of the shipped dashboard — a dev-time harness) runs the real extracted `<script>` block under jsdom, seeded with the actual project sample data files (`swimmers_pb.json`, `county_qt.json`, `regional_qt.json`). ~40+ checks covering: default tab state, tab-switch round-trips, card grouping, expand/collapse, show-all/fewer, chart-toggle math, tie-break sort logic, the mobile digit-truncation fix, and an XSS probe. **Confirmed still passing in full against v2.6 with no changes needed** — none of this session's fixes altered any behavior this suite depends on. Run with `node test_overview.js` after extracting the `<script>` block; `node --check` on the extracted block after every edit remains the project's standing convention.

**v2.6 additionally used several one-off jsdom probes** (not added to the permanent suite, since they were written to verify specific fixes rather than as regression coverage): an XSS probe for the stored-XSS finding (sanitiser rejection + render-time inertness), an accessibility probe (dialog semantics, focus trap/restore, `kbActivate` keyboard activation, FAB `aria-expanded` sync), a retry-logic probe against a mocked flaky `fetch`, and a status-dock-visibility probe covering all five show/hide entry points. Worth writing similar targeted probes for security- or accessibility-sensitive changes in future sessions — markup presence alone (`querySelector` finding an element) doesn't prove a fix actually closed the gap it was meant to close, as this session's own review found more than once.
