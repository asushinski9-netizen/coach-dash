# Coach Dashboard — Session Log

## v1.0 — June 2026

Built entirely in a single Claude chat session. The individual swimmer dashboard (`swim-dash`) already existed; this session created the coach dashboard from scratch as a companion tool.

**Phases:** Foundation (tabs, swimmer cards, filters, FAB) → Swimmer CRUD & Data Management → QT Editor Tabs → Squad Feature → Mobile Improvements → Bug Fixes & Code Quality.

Key design decisions: stat cards count swimmers not event+course combinations; `getEventBestStatuses()` for best-status-per-event across SC+LC; progress bar anchored at CT×1.06 / QT×0.988.

See `known-bugs-and-fixes.md` for the full bug list from this phase.

---

## v2.1 — June 2026 (security & bug patch)

Full code review identified 16 issues, all fixed — CSS class mismatches, `esc`/`esc2` unification into `escAttr()`, unescaped `innerHTML` injections, missing DOB/time validation on file load, try/catch around startup `JSON.parse` (`lsGet()` helper). `100 IM` re-added to `ALL_EVENTS`.

---

## v2.2 — June 2026 (Google Sheets sync)

New feature: PB data pulled from a Google Sheet via a Google Apps Script Web App (`apps_script.gs`). Reads "Basic Data" and "Results" tabs, computes PBs, detects DQs by cell colour, maps Sheet event abbreviations to dashboard names, token-authenticated via `PropertiesService`. Dashboard gained 🔄 Sync and ⚙️ Settings FAB buttons, merge logic (`mergeSwimmers`/`mergePbs`), merge modes (keep/hide/remove local-only swimmers), source badges.

---

## v2.2.1 — June 2026 (security patch + UX fixes)

Fixed a third-party ("Gemini") regression in `startSync()` — wrong localStorage key, wrong variable casing, spurious `window.location.reload()`, `mergeSwimmers()` defined but never called. Security: token fully removed from source (dashboard + Apps Script), moved to `localStorage`/`PropertiesService`; `openById(SHEET_ID)` → `getActiveSpreadsheet()`. UX: sync modal auto-close on success, improved empty states, password-field token input with show/hide.

---

## v2.3 — June–July 2026 (this session)

Multi-turn session covering: GitHub QT sync, a full Manage Data modal redesign, conflict resolution for manual uploads, championship-date de-hardcoding, and a cleanup pass. Turn-by-turn:

### Turn 1 — Initial v2.3 request (7 items, a–g)
- **(a)** Removed the code comment referencing the specific (now-fixed) inverted county QT data point. Kept the defensive `Math.min`/`Math.max` normalisation itself — general protection, not specific to that one historical bug.
- **(b)** Removed `loadSampleData()` and its six hardcoded fictional swimmers, plus the `if (SWIMMERS.length === 0) loadSampleData()` trigger.
- **(c)** Added `QT_DATA_URL` / `SE_QT_DATA_URL` GitHub raw-content constants to CONFIGURATION.
- **(d)** Redesigned the "Load Data Files" modal into "📤 Manage Data" — one card per data source (Swimmers/County QT/Regional QT), each with sync + upload + download actions, plus conflict resolution (Replace/Merge) when uploading over existing data. Chose (per user's answers to clarifying questions): swimmer merge conflict uses the same match-by-name+dob logic as Sheets sync; QT/Sheets sync stays manual-trigger only, no auto-fetch; removed a duplicate stale `#syncModal` block found during the rebuild.
- **(e)** Removed the standalone 🔄 Sync FAB button — that flow now lives inside the Swimmers card of Manage Data. FAB down from 5 to 4 children.
- **(f)** Hid the "Collapse All" button when there's no QT data or no rendered swimmer cards (`updateCollapseBtnVisibility()`), instead of always showing it regardless of data state.
- **(g)** Answered a question about the Settings modal's "each coach enters their own credentials" copy — clarified there's a single shared `ACCESS_TOKEN`, not per-coach auth; corrected the modal text accordingly. No Apps Script change needed (its own comments were already accurate).

### Turn 2 — Sync modal URL field
User reported the Sync modal's "no Apps Script URL configured" warning was a dead end — no way to fix it without leaving the modal. Added an inline URL input that appears only when no URL is saved yet (alongside the existing token field), pre-filling/hiding automatically once a URL exists from either source.

### Turn 3 — Clear Data feature
Added 🗑 Clear buttons per data-source card plus a 🗑 Clear All Data button at the modal bottom, each behind a `confirm()` naming exactly what will be wiped. Clears both the in-memory arrays and all related localStorage keys.

### Turn 4 — Four refinements based on a screenshot
1. Swimmer-count-shows-0-when-QT-missing was investigated and reframed as a cross-reference gap, not a bug at that point — added hint text explaining *why* tabs stay empty when one data type is loaded but not the other.
2. Disabled Download/Clear buttons per-card when that dataset is empty (previously clickable with nothing to act on); Clear All Data similarly disabled when everything is already empty.
3. Restructured each card's action buttons into two rows: sync (own row) → upload (own row) → download+clear (own row).
4. Added a third QT merge option, "Merge — overwrite matching," alongside the existing Replace and "Merge — add new only," so uploaded QT times can update existing rows instead of only skipping them.

### Turn 5 — Real bug: swimmer count not refreshing after Sheets sync
User showed a screenshot: sync succeeded (timestamp updated) but the Swimmers card still said "No swimmers loaded." Root cause found: `startSync()`'s success path updated `SWIMMERS`, saved to localStorage, and re-rendered the County/Regional tabs — but never called `refreshDataModalStatus()`, so the Manage Data modal sitting underneath the Sync modal never got told to refresh its own display. Fixed with one added call. Confirmed via code trace (not guesswork) that `mergeSwimmers` itself was correct — this was purely a missing refresh call.

### Turn 6 — Two more cleanup items
1. `coach_SHEETS_LAST_SYNC` wasn't cleared when swimmers were wiped via Clear — inconsistent with QT data's own last-sync clearing. Fixed.
2. Hardcoded `COUNTY_CHAMPS_DATE`/`REGIONAL_CHAMPS_DATE` constants were still driving age brackets and the info banner even when QT data was cleared — user correctly diagnosed the root cause from the codebase description alone. Asked 3 clarifying questions (which meta field to prefer, fallback behaviour with no date, manual-edit precedence) before touching age-bracket math since it affects real swimmer categorisation. Removed both hardcoded constants entirely; `getCountyChampsDate()`/`getRegionalChampsDate()` now read `QT_META.dateTo` (preferring it) falling back to `dateFrom`, returning `''` when neither is set. Age bracket functions return `null` in that case rather than computing against `Invalid Date`. `buildBanner()` now shows an explicit "no QT data — can't calculate Age Groups" message, and runs *before* the empty-data early return in `renderTab` so it's always current. Verified with a dry-run of the bracket logic against all four meta-date states (none/dateFrom-only/dateTo-only/both).

### Turn 7 — Full codebase cleanup pass
Systematic review: duplicate function definitions (none found), unused functions (none — two false positives from indirect `ageFn = isCounty ? getCountyAgeBracket : ...` reference pattern), orphaned `onclick` targets and `getElementById` calls (none), duplicate element IDs (none, confirmed the earlier `#syncModal` dedup held), dead CSS (`.swimmer-name`, `.fg.nopb-fg` — both removed), dead markup IDs in the data modal (three wrapper spans — removed), console.log debug leftovers (none), `escAttr`/`escHtml` consistency (fine), localStorage key naming symmetry (fine, all 11 keys). Consolidated `refreshDataModalStatus()`'s three near-identical per-card blocks into shared helpers. Flagged (but did not yet act on) significant drift between the markdown docs and the actual v2.3 code.

### Turn 8 — "Latest html doesn't load"
Investigated thoroughly before concluding: file tag balance (clean), JS syntax via `node --check` (clean), full HTML parse via Python's `html.parser` (clean, no errors), and — most conclusively — actually executed the entire file in a real DOM via `jsdom` with `runScripts: 'dangerously'`, capturing `window.onerror`, `error`/`unhandledrejection` events, and `VirtualConsole` jsdom-internal errors. Zero errors surfaced; `DOMContentLoaded` fired, `renderCounty()` ran and populated `#countyList` correctly (382-char empty-state HTML, matching a fresh-localStorage state). Concluded the file itself was not broken. Asked the user directly what "doesn't load" actually looked like and how they were opening it, rather than continuing to guess. **Resolved without a code change** — user confirmed "all good" without further detail, suggesting an environment/loading-method issue rather than a file defect. If this resurfaces, start by asking for the browser console error text directly.

### Turn 9 — This wrap-up
Full documentation refresh (this file, `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `project-brief.md`) to bring all docs in line with the actual v2.3 code, plus a fresh `coach_dashboard_handover.md` written for a new chat session with no prior context.

---

## Files — current state (v2.3)

| File | Version | Description |
|---|---|---|
| `index.html` | v2.3 | Main dashboard — ~2,740 lines |
| `apps_script_v2.2.1.gs` | v2.2.1 | Google Apps Script — 252 lines, unchanged this session |
| `start.py` | v2.2 | Localhost launcher (Mac/Linux) |
| `start.bat` | v2.2 | Localhost launcher (Windows) |
| `SETUP.md` | v2.2 | Apps Script deployment guide |
| `project-brief.md` | v2.3 | Project overview and goals |
| `architecture.md` | v2.3 | Code structure and data flow |
| `data-schema.md` | v2.3 | All JSON schemas |
| `known-bugs-and-fixes.md` | v2.3 | Bug log |
| `session-log.md` | this file | Full session history |
| `coach_dashboard_handover.md` | v2.3 | Executive handover, written for a fresh chat session |
