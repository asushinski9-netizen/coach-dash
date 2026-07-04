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

## v2.3 — June–July 2026

Multi-turn session covering: GitHub QT sync, a full Manage Data modal redesign, conflict resolution for manual uploads, championship-date de-hardcoding, and a cleanup pass. Full turn-by-turn history of that session is preserved in the v2.3 handover; summary: `QT_DATA_URL`/`SE_QT_DATA_URL` GitHub sync added, Manage Data modal rebuilt as one card per source with Replace/Merge conflict resolution, standalone Sync FAB folded into Manage Data, Clear Data added, hardcoded `COUNTY_CHAMPS_DATE`/`REGIONAL_CHAMPS_DATE` constants removed in favour of reading championship dates from QT metadata (`getCountyChampsDate()`/`getRegionalChampsDate()`), and a full doc refresh.

---

## v2.4 — July 2026 (this session)

Continuation session — no single big feature, a sequence of real bugs found via direct user testing/reporting, each traced to root cause in the actual code (not guessed at) and verified with executable proof before and after the fix, mostly using jsdom to run the real file rather than just reading it. Turn-by-turn:

### Turn 1 — Sheets-synced swimmers vanishing on manual merge
**Reported:** synced 62 swimmers from Google Sheet, uploaded a 22-swimmer file choosing "Merge," and the original 62 disappeared entirely.
**Root cause:** `mergeSwimmers()` is shared by two call sites (Sheets sync and manual upload) but was written assuming the incoming set is always a *complete, authoritative* snapshot of a source — true for a Sheets sync, false for an arbitrary uploaded file. Its local-only-swimmer-retention step explicitly skipped anything tagged `source:'sheet'`, on the assumption that absence from a fresh sheet pull means genuine removal upstream. Called with a 22-swimmer upload instead of a full sheet snapshot, all 62 existing sheet-tagged swimmers hit that skip and were silently dropped — not "removed," not counted in stats, just omitted from the merged array.
**Fix:** added an `opts.sourceIsAuthoritative` parameter to `mergeSwimmers()`. Sheets sync passes `true` (unchanged behaviour). Manual upload now passes `false`, so existing swimmers absent from the uploaded file are always kept regardless of their `source` tag. Verified via two isolated simulations extracted from the actual file: the reported 62+22 scenario (all 84 retained) and a Sheets-sync-with-genuine-removal scenario (unchanged correct behaviour — a swimmer dropped from a fresh sheet pull is still correctly demoted to local and handled per merge mode).

### Turn 2 — Stale sync timestamp + US date format
**Reported two issues:** (a) after Clear All Data, opening the Sync modal still showed an old "Last synced" timestamp; (b) all sync timestamps displayed in US `M/D/YYYY` format.
**Root cause (a):** the Sync modal has its own timestamp span (`#syncLastTime`), separate from the Manage Data modal's inline spans. It was only ever written once, at `DOMContentLoaded` — never re-read when the modal itself opened, so a Clear Data action (which correctly updated localStorage and the *other* display) left this one stale until a full page reload.
**Root cause (b):** every sync-timestamp display called `.toLocaleString()` with no locale argument, defaulting to the browser's locale.
**Fix:** added `fmtDateTime()` (fixed `DD/MM/YYYY, HH:MM` 24hr format, locale-independent) and used it at all four call sites. `showSyncModal()` now re-reads `coach_SHEETS_LAST_SYNC` from localStorage every time it opens instead of relying on stale DOM state from page load.

### Turn 3 — "Not shown" diagnostic added (proactive, in response to a validation request)
User asked to re-validate why only 47 of 62 synced swimmers were visible with no filters applied, suspecting missing PBs, and asked for a Google Sheet cross-check. Since the actual private Sheet isn't reachable from this environment, built the validation into the dashboard instead: traced the root cause to swimmer cards being fully omitted (not just individual rows) whenever they produce zero comparison rows, with zero indication why. Found a second contributing factor: Sheets-synced data skips the manual-upload validation path (`sanitiseSwimmersData`) entirely, so a malformed `dob` or unexpected `gender` value produces the identical "vanished swimmer" symptom as a genuine zero-PB swimmer. Added `diagnoseZeroRowSwimmer()` and an expandable `<details>` footer note per tab, splitting excluded swimmers into "likely data issue" (bad dob/gender — QT never matched at all) vs. "genuinely no PB recorded." Verified against four synthetic cases run through the real extracted functions.

### Turn 4 — Collapse All as the default
Requested: County/Regional tabs should default to all cards collapsed. `collapseAllState` defaults changed to `true`; `showTab()` now force-resets it to `true` every time a swimmer-list tab is opened (not just on first load), so re-visiting a tab always re-collapses even if the coach had expanded everything earlier in the session; `resetFilters()` updated to match; `updateCollapseBtnVisibility()` now also syncs the button label on every render instead of only after an explicit toggle click, so it can't drift out of sync regardless of entry point. Verified with a real jsdom interaction test: load → expand all → switch tabs → switch back — re-collapses correctly at each tab-open, button label always accurate.

### Turn 5 — Diagnostic footnote gave a wrong reason under an active filter
**Reported:** with Status=Qualified applied, 14 shown / 70 not shown, footnote said all 70 had "no PB recorded" — false; most simply weren't Qualified.
**Root cause:** `diagnoseZeroRowSwimmer()`'s fallback branch fired whenever a swimmer had any QT-matching event at all, regardless of whether they actually had a PB recorded — it never checked for a PB, just assumed the two-way split (data issue vs. no-PB) was exhaustive.
**Fix:** added a third category, `'filtered'` — swimmer has real PB(s) but none satisfy the currently active Course/Stroke/Status filter, with a message describing their actual best status. Also fixed the severity framing: the summary line's alarming gold/⚠️ styling is now reserved for genuine data issues; a purely filter-driven exclusion count renders in neutral grey, since a status filter hiding most of the squad is expected behaviour, not a problem. Verified against the exact reported shape (a real "Outside" PB under a Qualified filter) alongside the two pre-existing categories to confirm no regression.

### Turn 6 — Championship banner misstated a date range as a single day
**Reported:** "The 2026 County Championships took place on 15 Feb 2026" is wrong — that's the last day of a multi-day event, not the only day.
**Root cause:** the banner used the single derived `champDate` value (which is `dateTo` when both dates are set) as if it were "the" date of the event.
**Fix:** added `describeChampDates()`, which inspects `dateFrom`/`dateTo` from QT meta directly and produces accurate phrasing for five distinct shapes: date range, genuine single-day event, only `dateTo` known ("concluded on"), only `dateFrom` known ("began on"), each in both past- and upcoming-tense. Applied to both banner branches (the upcoming-tense branch had the identical bug, not previously reported). Verified all five permutations plus the exact reported date pair.

### Turn 7 — Full codebase review (requested)
Systematic pass: duplicate functions/variables/DOM IDs (none), static analysis for unused functions (22 candidates, all false positives — called via inline `onclick`, confirmed against full HTML), localStorage/JSON.parse error-safety (clean, all routed through `lsGet()` or an equivalent local try/catch), leftover debug statements (none), silently-swallowed errors (one, intentional and documented).

**Found and fixed three real, exploitable stored-XSS vulnerabilities**, each confirmed with an actual jsdom proof-of-concept before and after the fix — not inferred from reading the code:
1. `escAttr()` only escaped backslash/single-quote (the inner JS-string-literal layer of `onclick="fn('${x}')"`), never double-quote (the outer HTML-attribute layer). A crafted `id` in a manually-uploaded `swimmers_pb.json` (never validated by `sanitiseSwimmersData`) broke straight out of the attribute and injected a real, browser-executed event handler. Fixed by layering HTML-entity escaping on top of the existing JS-string escaping, in the correct order.
2. QT Editor rendered `gender`/`event` as raw, unescaped HTML text content — a crafted `event` string in an uploaded QT file injected a real DOM element (confirmed: `<img onerror=...>` executed). Wrapped both in `escHtml()`.
3. `sw.gender` rendered unescaped in the swimmer card meta line — lower risk in practice since manual uploads validate gender strictly, but Sheets-synced data bypasses that validation entirely (per Turn 3's finding), so it wasn't actually guaranteed safe. Fixed for consistency with how `sw.squad` was already handled.

All three fixes re-verified with a full regression pass (apostrophe in a name, ampersand in a competition title) to confirm no double-encoding or display breakage on legitimate data.

**Flagged, not fixed:** the Sheets sync token is sent as a URL query parameter (`?token=...`), not a header — a known anti-pattern (browser history, server/proxy access log exposure). Not fixed because the correct remedy (POST with the token in a JSON body) requires a coordinated change to `apps_script_v2.2.1.gs`, which is out of scope this session and not available to inspect — changing only the client risks breaking a currently-working sync without the ability to test against the real Apps Script endpoint.

### Turn 8 — Former Swimmers unaccounted for in the "not shown" diagnostic
**Reported:** 85 total swimmers, 69 shown, 15 reported as no-PB — leaves 1 swimmer unaccounted, who turned out to be a Former Swimmer.
**Root cause:** the Former Swimmer gate (and the merge `hidden` flag, same shape of bug) excludes swimmers from `visibleSwimmers` — one step *before* the Turn 3 diagnostic even runs, since that diagnostic only ever inspected swimmers that made it into `visibleSwimmers` in the first place.
**Fix:** the diagnostic now also scans the full `SWIMMERS` array for the two *default/implicit* exclusion gates (Former Swimmer, merge-hidden) and adds them as their own labelled buckets. Deliberately did **not** extend this to explicit Gender/Age/Squad/Name-search filter exclusions — those are self-evident from the visible filter bar the coach just set, unlike a default gate that's active even with no filters applied. Extracted the note-building logic (previously duplicated three times across renderTab's exit paths) into a shared `buildFooterNote()` so all three paths — including the two early-return "no data"/"no matches" cases — report former/hidden swimmers consistently. Verified against the exact reported shape (85 total: 69 shown, 15 no-PB, 1 former) — footer note reconciles exactly, and re-confirmed the "Show Former Swimmers" toggle still correctly reveals the swimmer afterward.

---

## Files — current state (v2.4)

| File | Version | Description |
|---|---|---|
| `index.html` | v2.4 | Main dashboard — ~2,930 lines |
| `apps_script_v2.2.1.gs` | v2.2.1 | Google Apps Script — 252 lines, unchanged since v2.2.1 |
| `start.py` | v2.2 | Localhost launcher (Mac/Linux) |
| `start.bat` | v2.2 | Localhost launcher (Windows) |
| `SETUP.md` | v2.2 | Apps Script deployment guide |
| `project-brief.md` | v2.4 | Project overview and goals |
| `architecture.md` | v2.4 | Code structure and data flow |
| `data-schema.md` | v2.4 | All JSON schemas |
| `known-bugs-and-fixes.md` | v2.4 | Bug log |
| `session-log.md` | this file | Full session history |
| `coach_dashboard_handover.md` | v2.4 | Executive handover, written for a fresh chat session |
