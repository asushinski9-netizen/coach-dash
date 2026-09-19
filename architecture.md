# Coach Dashboard — Architecture (v2.8)

## Overview

Single HTML file (`index.html`, ~3,595 lines). No build step, no dependencies beyond the CDN-free vanilla JS in the page itself — including the Overview tab's charts, which are hand-rolled SVG/CSS rather than a charting library, to preserve that self-contained architecture. All state lives in `localStorage`. Logo is embedded as a base64 data URI. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal. As of v2.8, that modal also has a fourth, additive card: a single-bundle Backup & Restore mechanism spanning all three sources at once.

The Overview tab is the default tab on page load. County/Regional/editor tabs still render lazily on first switch to each.

**v2.8 in one paragraph:** a focused, single-feature session — Backup & Restore, exactly as scoped in `se-pb-import-and-history-plan.md` Section 6. A new "🗄️ Full Backup & Restore" card in the Manage Data modal lets a coach download everything (Swimmers + County QT + Regional QT) as one JSON bundle, and restore from one later. Restore is Replace-only, validated through the *existing* per-source sanitisers, and shows an explicit before→after count confirmation naming exactly what will change before anything is touched. Deliberately excludes `coach_SYNC_URL`/`coach_SYNC_TOKEN` from the bundle. Additive only — none of the three existing per-source cards were touched, removed, or restructured. No schema changes; this is the first of the four SE-import-roadmap sessions (v2.8–v2.11) and is fully independent of the other three. See `known-bugs-and-fixes.md`'s "Added in v2.8" section and `session-log.md` for the full writeup.

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
    #dataModal        📤 Manage Data — one card per source (sync/upload/download/clear),
                       PLUS (v2.8) a fourth "🗄️ Full Backup & Restore" card spanning all
                       three at once; action buttons (Clear All Data / Close) precede the
                       status/error/conflict dock in the markup (v2.7 fix — see below);
                       the new v2.8 card sits between the Regional QT card and that button
                       row, so the dock remains the modal's true last child
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
  13. OVERVIEW TAB         See dedicated section below — unchanged in v2.8
  14. TAB SWITCHING        showTab, toggleCollapseAll, toggleSwimmer, updateCollapseBtnVisibility
  15. THEME                toggleTheme, applyTheme
  16. DATA: LOAD/SAVE      showDataModal, sanitiseSwimmersData, applySwimmersUpload,
                           applyQTUpload, resolveDataConflict, downloadSwimmers, clearData,
                           refreshStatusDockVisibility, and — new in v2.8 —
                           downloadBackupBundle, loadBackupFile, applyBackupRestore
                           (see "Full Backup & Restore" section below)
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

## Manage Data Modal — Full Backup & Restore (new in v2.8)

A fourth card, "🗄️ Full Backup & Restore," sits in `#dataModal` after the three existing per-source cards (Swimmers, County QT, Regional QT) and before the Clear All Data / Close button row — which itself still precedes `#dataModalStatusDock` (see the v2.7 DOM-order note below; the dock remains the modal's true last child).

### Download — `downloadBackupBundle()`

Builds a single JSON bundle from the live in-memory globals:

```json
{
  "version":    "coach-dashboard-backup-1",
  "generated":  "2026-09-18T10:00:00.000Z",
  "swimmers":   [ ...SWIMMERS... ],
  "countyQt":   { "meta": { ... }, "times": [ ...COUNTY_QT... ] },
  "regionalQt": { "meta": { ... }, "times": [ ...REGIONAL_QT... ] }
}
```

Downloaded as `coach_dashboard_backup_YYYY-MM-DD.json`, same Blob/`<a>` pattern used by every other download in the file. **Deliberately excludes `coach_SYNC_URL`/`coach_SYNC_TOKEN`** — per-browser credentials, not squad data; bundling a secret token into a shareable backup file would be a real footgun.

### Restore — `loadBackupFile()` → `applyBackupRestore()`

1. `loadBackupFile()` reads and parses the chosen file. A file that isn't an object, or has none of `swimmers`/`countyQt`/`regionalQt` recognisably present, is rejected immediately with an error — no confirmation is shown for a file that isn't a plausible backup at all.
2. Whichever of the three pieces *are* present are run through the same sanitisers every other upload path uses — `sanitiseSwimmersData()` for `swimmers`, `parseQTFull()` + `sanitiseQTData()` for `countyQt`/`regionalQt` — **before** the confirmation dialog is shown, so the dialog's counts reflect what will actually be applied, not raw/possibly-dirty file counts.
3. A `confirm()` names, per dataset, the current count → the restored count, or — for any piece **not** present in the bundle — states plainly that dataset will be left untouched. This is deliberately **Replace-only per dataset present**, not all-or-nothing: a bundle missing one piece (e.g. predates Regional QT being loaded, or a coach intentionally exported only after clearing something) still restores the pieces it does have rather than being rejected wholesale. See `known-bugs-and-fixes.md` for the reasoning behind this choice.
4. On confirmation, `applyBackupRestore()` replaces `SWIMMERS` / `COUNTY_QT`+`COUNTY_QT_META` / `REGIONAL_QT`+`REGIONAL_QT_META` wholesale for each present piece, persists via `lsSet()`/`saveQTToStorage()` (checking each write's success, same convention as every other data-entry path), surfaces sanitiser skip/coerce counts in the final status message, then re-renders County/Regional/Overview and refreshes the modal's own counts/hints.

**Uses the existing `confirm()` pattern** (matching `clearData()`'s existing irreversible-bulk-action pattern) rather than the inline `dataConflictBox` UI — the conflict box is built around a Replace/Merge *choice*, and Restore only ever has one path (Replace-per-present-piece), so a second UI paradigm wasn't warranted.

**Schema-agnostic by construction:** the bundle just snapshots/restores `SWIMMERS`/`COUNTY_QT`/`REGIONAL_QT` verbatim through their existing sanitisers — it doesn't interpret or depend on the current shape of a swimmer or PB record. This means v2.10's planned widening of the `pbs` array (multiple dated entries per event+course) requires **no changes to Backup & Restore itself** — whatever shape `sanitiseSwimmersData()` accepts at that point, the bundle already round-trips.

---

## Overview Tab

Unchanged in v2.8. A squad-wide, **unfiltered** "coach's morning briefing" — no Squad/Gender filter bar of its own, deliberately, since it's meant to be a single glance at the whole squad rather than another filterable list like County/Regional. Three sections, in this order: **Squad Composition** (top), **Hot Right Now**, **The Bubble List**.

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

**Security note (still relevant):** `collectRecentPbs()` reads `sw.pbs` **directly**, not through `buildSwimmerRows()`'s `ALL_EVENTS`/`'S'|'L'`-constrained lookup path — meaning, unlike County/Regional/Bubble List, this section is not safe-by-construction against a bad `pb.event`/`pb.course` value. A real stored-XSS vulnerability was found and fixed here in v2.6 (unescaped `pb.course` in a `class` attribute) — see `known-bugs-and-fixes.md`. Any future change to this function should keep in mind that it's the one place in the app that doesn't get the "safe by construction" property for free. **This is directly relevant to the planned SE PB import (v2.11 — see `se-pb-import-and-history-plan.md`)** — whatever code eventually writes SE-sourced PBs into `sw.pbs` must produce data that already satisfies `sanitiseSwimmersData()`'s existing `pb.event`/`pb.course`/`pb.date` checks, or extend them, rather than assuming a new import path is automatically safe.

### Section 3 — The Bubble List

`buildBubbleList(marginPercent, includeHidden)` → `groupBubbleEntriesBySwimmer()` → `renderBubbleList()`. Swimmers with a real, recorded PB within a configurable `%` margin (`#bubbleMargin`, default 5) of a County or Regional QT they haven't yet hit (`status` is `Consideration` or `Outside`, `gapQ > 0`). An "Include hidden / Former Swimmers" checkbox (`#bubbleIncludeHidden`) overrides `getOverviewEligibleSwimmers()` with the full `SWIMMERS` array when checked, tagging each included swimmer with `hiddenReasonDetail()`. The margin% value is persisted to `localStorage` (`coach_BUBBLE_MARGIN`) and restored on page load, if within its valid range.

Sort: smallest gap % first (a swimmer's own entries are naturally gap-ascending as a consequence of `buildBubbleList`'s global sort — see inline comment), tiebroken by most bubble opportunities (not name).

Displayed stat: the actual **time difference in seconds and the QT cutoff itself** ("0.12s off" / "QT 2:24.00"). No leading `+` sign. Meta line is two rows — championship type (County/Regional) on top, event + course underneath.

Unlike Hot Right Now, this section's `e.event`/`e.course` originate from `buildSwimmerRows()`'s constrained lookup and are safe by construction — the `escHtml(e.course)` here is consistency/defense-in-depth, not a fix for an exploitable path.

---

## CSS Variables

Unchanged in v2.8 — the new Backup & Restore card reuses the existing `.data-card`/`.data-card-head`/`.data-card-title`/`.data-card-row`/`.fbtn` classes verbatim, no new CSS was needed.

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

### Fixed-height pill pattern (`.squad-badge`, `.gender-pill-mobile`) — rewritten in v2.7, unchanged in v2.8

Both share the same layout strategy: an explicit `height: 19px` plus `display: inline-flex; align-items: center; justify-content: center`, rather than the v2.6 approach of matching `line-height` between the two. Paired with the ♂/♀ Unicode text-presentation variation selector (U+FE0E) on the swimmer-meta glyphs. See `known-bugs-and-fixes.md`'s "Fixed in v2.7" section for the full root-cause writeup.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤500 px (mobile) | Header tagline drops to its own row; Overview tab takes the full first row, County/Regional pair up on row 2; tabs wrap; stat cards compact; filter bar becomes grid; progress column hidden; gender pill inline-flex; squad badges match its height exactly; QT editor tabs hidden; Overview card grids go 2-up; stroke names abbreviate (FR/BK/BR/FLY/IM); the course badge inside Overview entry rows shrinks correctly; Manage Data's status/error/conflict messages dock sticky to the bottom of the modal once they have something to show, with that dock still the true last child of the modal (v2.7 fix, unaffected by v2.8's new card since it was inserted above the button row, not below the dock) |
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
  loadBackupFile → applyBackupRestore()  → per present piece: sanitiseSwimmersData() /
                                            sanitiseQTData() → lsSet(...) / saveQTToStorage()
                                            (v2.8 — reuses the same two sanitisers above,
                                            just fans one file out to up to three targets)
```

### QT Storage

```
coach_COUNTY_QT_FULL   = { meta: {title, dateFrom, dateTo}, times: [...] }
coach_REGIONAL_QT_FULL = { meta: {title, dateFrom, dateTo}, times: [...] }
```

`parseQTFull()` accepts both this format and the legacy plain-array format. The legacy-format keys (`coach_COUNTY_QT`/`coach_REGIONAL_QT`) are no longer read as a permanent fallback — `migrateLegacyQTKey()` runs once at startup and, if only the legacy key has data, writes it into the new key and deletes the legacy key. No stored-data shape changes in v2.8.

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

**Forward-looking note:** the planned SE PB report import (v2.11) will introduce a *new* code path that writes into `sw.pbs`. Whatever that code turns out to be, it must run its parsed rows through `sanitiseSwimmersData()` (or an equivalent enforcing the same constraints) before persisting — the safety property here comes from validation at the point of entry, not from where the data happened to originate. **The v2.8 Restore path already follows this rule** — it runs the bundle's `swimmers` array through the exact same `sanitiseSwimmersData()` call, not a bespoke restore-specific path.

### Escaping conventions (unchanged)

- **`escAttr()`** — double-layer escape (JS-string then HTML-attribute) for values embedded in `onclick="fn('${value}')"`.
- **`escHtml()`** — plain HTML text/attribute escaping for everything else.
- Rendering-side escaping remains the actual security boundary for anything that reaches the DOM — validation closes data-quality gaps and, in the Hot Right Now case above, closed an actual injection point at its source too.

### Validation, symmetric across upload, sync, AND restore (extended in v2.8)

- `sanitiseSwimmersData()` is called from `startSync()`, `loadSwimmersFile()`/`applySwimmersUpload()`, and — new in v2.8 — `loadBackupFile()`/`applyBackupRestore()`.
- `sanitiseQTData()` validates `gender`/`course`/`event`/`age`/`qualify`/`consider`, used by `applyQTUpload()`, `syncQTFromGitHub()`, and — new in v2.8 — the County/Regional pieces of a restored backup bundle.
- No new sanitiser was written for the backup bundle itself — it's just JSON containing the same three shapes every other path already validates, so the existing two sanitisers were reused directly rather than duplicated.

### Write-side localStorage protection (unchanged since v2.6)

Every `localStorage.setItem()` call goes through `lsSet()`; every call site checks its return value, including the three new `applyBackupRestore()` write sites in v2.8. Where a dedicated status UI exists, failure is reported there; otherwise `warnStorageFailureOnce()` alerts the coach once per page load.

### Apps Script hardening (unchanged since v2.6)

`safeCompare()` for the token check; `setToken()` guarded against accidental overwrite. See `apps_script_v2.2.2.gs`.

### Accessibility (unchanged since v2.6)

Viewport allows pinch-zoom; every mouse-only "clickable div" has `role="button" tabindex="0"` and responds to Enter/Space via `kbActivate(event)`; all four modals have `role="dialog" aria-modal="true" aria-labelledby="<id>"` with focus trap/restore (`openModalA11y`/`closeModalA11y`/`trapModalTab`/`getFocusableIn`); FAB buttons have `aria-label` and a synced `aria-expanded`. The new Backup & Restore card's controls (file input, two buttons) participate in the modal's existing focus trap automatically — no new a11y wiring was needed since they're plain `<input>`/`<button>` elements, not custom clickable-divs.

---

## Manage Data Modal — Mobile Status Dock (v2.6, DOM order corrected in v2.7, verified intact through v2.8)

**v2.6 background:** on mobile, `dataStatus`/`dataError`/`dataConflictBox` sat in normal document flow below three data-cards, so an upload-triggered merge conflict or sync error could go completely unnoticed unless the coach scrolled down afterward. **Fix (v2.6):** the three elements were wrapped in `#dataModalStatusDock`. `refreshStatusDockVisibility()` — called from `setDataStatus()`, `clearDataStatus()`, `setDataError()`, `showDataConflict()`, and `cancelDataConflict()` — toggles a `dock-visible` class on the wrapper based on whether any of the three is actually showing. Only when that class is present does the mobile-only CSS make the dock `position: sticky; bottom: -20px; margin: 10px -20px -20px; ...` — bleeding it flush to the modal's own edges.

**The v2.7 bug and fix:** the dock's negative bottom margin implicitly assumed it was the modal's last element; the Clear All Data / Close row previously followed it in the markup, so the negative margin pulled that row up underneath the dock's own painted area. Fixed by reordering the markup — the button row now precedes the dock, which is the modal's true last child.

**v2.8 risk and how it was avoided:** adding a fourth card to this exact modal is precisely the kind of change that could reintroduce the v2.7 bug by accident (e.g. appending the new card after the button row instead of before it). The new "🗄️ Full Backup & Restore" card was inserted **between the Regional QT card and the button row** — i.e. still fully before the dock — and this was explicitly verified with a jsdom probe asserting `modalBox.lastElementChild === statusDock` and that the button row precedes the dock in document order, the same two assertions the v2.7 probe used. See `session-log.md` for the probe details.

Desktop CSS is completely untouched throughout (no sticky dock there — never needed one, taller viewport).

---

## localStorage Key Map

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData, **applyBackupRestore (v2.8)** | User-authoritative. Every write goes through `lsSet()` and its result is checked |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage (called from applyQTUpload, syncQTFromGitHub, and **applyBackupRestore, v2.8**) | `saveQTToStorage()` returns success/failure |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage (same callers as above) | Same as above |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Plain array | *(legacy)* | `migrateLegacyQTKey()` completes the migration on next load instead of reading this forever |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` / `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared by all coaches — not per-coach auth (accepted trade-off, see `project-brief.md`). **Deliberately excluded from the v2.8 backup bundle** — never read or written by `downloadBackupBundle()`/`applyBackupRestore()` |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub | |
| `coach_HOT_CUTOFF_DAYS` | string (integer) | Hot Right Now's cutoff input | Restored on load if in range 1–365 |
| `coach_BUBBLE_MARGIN` | string (float) | Bubble List's margin input | Restored on load if in range 0.1–20 |

**No new localStorage key was introduced by v2.8** — a restored backup is applied straight onto the same three existing keys above; the bundle file itself is never persisted anywhere, only read once at restore time.

Everything else about the Overview tab's session state (chart-toggle exclusions, per-card expand/collapse, show-all/fewer) remains intentionally session-only — matching how `collapseAllState` already behaves for County/Regional.

**Not yet added, planned:** an `se` field (`SE#`) on the swimmer record and a per-PB `source` field (`gala`/`se`/`manual`) — see `se-pb-import-and-history-plan.md`. Neither exists in the current schema; `data-schema.md` documents them separately as planned, not current. **v2.8's Backup & Restore is schema-agnostic and needs no changes when these land** — see the note under "Manage Data Modal — Full Backup & Restore" above.

---

## FAB Speed Dial

👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙/☀️ Theme. Every button has `aria-label`; the parent's `aria-expanded` tracks open/closed state. Unchanged in v2.8 — Backup & Restore lives inside the existing 📤 Manage Data modal, not as a new FAB entry.

---

## Retry Logic

`fetchWithRetry(url, options, maxAttempts, onRetry)` — used only by `syncQTFromGitHub()`. Retries network-level failures (fetch throwing, e.g. briefly offline) and HTTP 5xx responses with a short linear backoff (`600ms × attempt`), up to `maxAttempts` total tries; a 4xx response (e.g. a renamed/missing file) is returned immediately without retrying, since that's a configuration problem retrying won't fix. `onRetry(attempt, maxAttempts)` lets the caller update its status message between attempts ("retry 1/2", etc). Does not cover genuinely extended offline periods — see `known-bugs-and-fixes.md` Open Issue #4. **Not used by Backup & Restore** — restore is a local file read (`FileReader`/`readJsonFile()`), not a network fetch, so there's nothing to retry.

---

## Testing

`test_overview.js` (not part of the shipped dashboard — a dev-time harness) runs the real extracted `<script>` block under jsdom, seeded with the actual project sample data files (`swimmers_pb.json`, `county_qt.json`, `regional_qt.json`). ~40+ checks covering: default tab state, tab-switch round-trips, card grouping, expand/collapse, show-all/fewer, chart-toggle math, tie-break sort logic, the mobile digit-truncation fix, and an XSS probe. **Unchanged in v2.8** — this session touched only the Manage Data modal (a new, additive card) and did not touch anything the Overview-tab-focused suite asserts on, so it wasn't re-run; it should still be re-confirmed the next time a change touches the Overview tab specifically.

**v2.8 used a dedicated, separate probe** (`probe_backup_restore.js`, not added to the permanent suite — following the same convention `probe_fixes.js` established in v2.7) covering: the new card renders additively alongside the three existing ones; the v2.7 DOM-order property (`modalBox.lastElementChild === statusDock`, button row precedes dock) still holds with the new card in place; the downloaded bundle has the correct shape and genuinely excludes the sync URL/token; a full restore replaces all three datasets with confirmed before→after counts and persists correctly; a **partial** bundle (one piece missing entirely) leaves that piece completely untouched while still replacing the pieces that were present; and a file with none of the three recognisable pieces is rejected with no confirmation shown at all. 32/32 checks passed.

**Reminder for any future session reconstructing `index.html` locally for testing:** the embedded base64 logo is large; if it gets stubbed with a placeholder to make local iteration easier, the real logo **must** be restored (and any fixes re-verified afterward) before the file is considered final.
