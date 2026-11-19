# Coach Dashboard - Handover Document (v2.13.8 shipped, UAT passed -> next: remaining v2.13 items)

**Files:** `index.html` (title **v2.13.8**) and `apps_script_v2.2.4.gs` (**build 2.2.4-b5**, unchanged since v2.12.8). **979 automated checks, 0 failures.** Coach UAT passed every step for v2.13.1 to v2.13.8 (v2.13.6 was replaced by v2.13.7 before UAT). Not yet pushed to GitHub: see Section 11.

---

## 1. Read these first (in order)
1. This document.
2. `known-bugs-and-fixes.md` - open issues #14, #19, #20, #23, #27, #28, #29, #30 are the v2.13 backlog.
3. `architecture.md` (v2.12 through v2.12.11 sections) and `data-schema.md` (PB entry fields `source`, `replaced`, `removed`; Sections 5, 10, 13).
4. `se-pb-import-and-history-plan.md` and `se-matching-scenarios.md`.
5. `session-log.md` - the v2.12.x entries record what went wrong along the way; lessons are in Section 7.

---

## 2. Roadmap

| Version | Scope | Status |
|---|---|---|
| **v2.12 "Data foundations"** (v2.12.0 to v2.12.11) | every dated result from the Sheet, heats and finals, matching/identity fixes, SE import data-safety fixes, review-screen polish | **SHIPPED, UAT passed** |
| **v2.13 "Tabs"** | Dedicated **Swimmers** tab (#9) + **Data** tab; plus the coach-requested review-screen polish and wording sweep in Section 5 | Confirmed in principle; scope still to agree (Section 5) |
| **v2.14 "Progression"** | visual progression / all-results view (swim-dash model) on the full history | Confirmed as the sequence |

**Schema rename before v2.14 (proposal):** `pbs` no longer means "personal bests" (it holds every dated swim). Rename = schema-version change across swimmer JSON, backup bundle, Apps Script payload and UI wording (#19). Do it as its own session just before Progression.

---

## 3. What v2.12 shipped (one screen)
- **Apps Script 2.2.4:** emits **every** non-DQ Results row (not only the fastest). Same-day swims (heat + final) stay separate, told apart by time; exact duplicate rows collapse; undated rows keep fastest-only; ordered by date then record number (Results column A). Payload `version 2.4` adds `build`, `warnings` (recent swims >15% faster than the swimmer's previous best; flagged swims never become the baseline) and `stats` (skipped rows with record numbers and reasons, timing split). Reads the Results tab in 250-row chunks and stops after 2 blank chunks (the Sheet has ~3,100 formula rows below the data; every read costs roughly 1.7–2.5 ms **per row**).
- **Dashboard:** `mergePbs` keys by event+course+date+**time**; SE-confirmed protection is directional (a slower same-day Sheet swim is a plausible heat and is added; a faster one is protected and flagged); `mergePbEntry` matches the same-day entry with the same time before declaring a conflict; Hot Right Now = one improvement per event per day; swims the Sheet no longer lists are **reported, never deleted**; sync retries 404/5xx/timeouts (3 attempts, 90 s each) with plain-language errors; the sync message shows the script build and warns loudly if it is not `EXPECTED_SCRIPT_BUILD`; skipped Results rows, unusually fast swims and orphaned swims are listed by record number.
- **Matching:** sync uses the same `normaliseNameKey` as the SE import and **stops (nothing changed)** if two swimmers would collapse to one key; swimmer **ids are forced unique** (and repaired on load); a swimmer whose DOB differs only slightly (one field, or a day/month swap) is matched via same id + name and the Sheet's DOB wins; the SE import shows both DOBs with a day/month-swap hint and lists DOB mismatches in its summary; accents are folded for first-name similarity only; wording fixed (#12).
- **Small:** stale Manage Data status cleared when starting a Sync/SE import; test paths configurable (`INDEX_FILE`, `FIXTURE_DIR`, `SE_SAMPLE_DIR`).

---

### 3b. What v2.12.8 to v2.12.11 added (post-deployment fixes after real-data testing)
- **Data-loss bug fixed (v2.12.8):** the SE import's "Replace" could silently delete a swim when another same-time entry existed (the duplicate check ignored an exact match already on file). Now an SE swim already on file exactly is never a "probable duplicate"; Replace only swaps one entry for the SE one; the closest-dated same-time entry is offered; an SE-sourced entry is never offered; a **per-swimmer safety check** refuses to write unless the result count changed by exactly the reported amount.
- **"Use SE report" is remembered (v2.12.8):** the SE entry stores `replaced: [time]` so a later Sheet sync does not re-add the overridden Sheet time. **"Keep both (heat and final)"** adds the SE swim beside the existing one.
- **Swimming results count line (v2.12.8):** "Swimming results on file: before -> after (+n)" in the sync message, the SE import summary (with a red warning if it does not balance) and Manage Data.
- **Several same-time entries (v2.12.9):** a duplicate carries all candidates; the coach picks which entry the SE swim replaces, or **Merge all N into the SE swim** (explicit deletion, reported, balanced). Same-time repeats are listed as "possible duplicates" in the review, never deleted.
- **Amy-type conflicts (v2.12.10):** every conflict radio states its outcome; a fourth choice **"Use SE report and remove the other copy"** (offered only when another non-SE copy of the on-file time exists) stores `removed: [{date, time}]` so a sync does not bring the row back. Bulk buttons are named "<choice> for all"; the two deleting choices have **no** bulk button.
- **Review polish (v2.12.11):** swimmer name on its own row above the bulk buttons (conflicts and duplicates); a Time conflicts explainer; an orange `.se-note-warn` note for every time difference (faster, or slower with a "would make your best slower" warning) and for several same-time entries.

---

## 4. Decisions already locked — do not re-litigate
All of the v2.11 list still holds (never scrape SE; no third-party scripts; `mergePbEntry` spec; PB history model; the SE import is forward-accumulating; it never writes DOB/gender/squad/name/hidden or creates/removes swimmers; replace-date is an update; preview and apply share `seComputeOutcomes()`; Apply is live only when it changes something; UI text uses hyphens, not em-dashes; Backup & Restore is Replace-only; Remove-mode sync keeps its confirmation). New in v2.12:
- **A heat and a final are two swims.** Same-day entries are separate; the identity of a dated swim is event + course + date + time. `mergePbEntry` was extended **additively** (single-entry behaviour identical). The record number (Results column A) is for ordering and labels only; it is never saved on a swimmer and never part of identity.
- **The Sheet is authoritative for name, DOB, gender and (when present) SE #.** A DOB that differs slightly is corrected from the Sheet; a bigger difference is **not** merged (it could be a different child) but is warned about. **Never match on name alone.**
- **Never delete data automatically on a sync.** Orphaned (edited/deleted-in-Sheet) swims are reported; the coach deletes them.
- **Swimmer ids are unique** (`ensureUniqueIds`), enforced on load, merge, upload-replace and restore. Edit/Delete look up by id.
- **A stale Apps Script deployment must be loud.** Bump `SCRIPT_BUILD` in the script **and** `EXPECTED_SCRIPT_BUILD` in `index.html` (and the page title) whenever either changes behaviour.
- **The "wrong script build" warning stays visible in any future maintenance mode;** only the routine `(Apps Script …, history check …)` suffix may be hidden (#27).
- **Tests first, shown red, then green** (Section 7). Estimates are labelled as estimates until measured.
- Per-coach auth, `doPost`/header token and the other old items stay deferred unless the coach asks.

---
Added by v2.12.8 to v2.12.11:
- **The only things that may delete swim results are two explicit coach choices:** "Merge all N into the SE swim" (duplicates) and "Use SE report and remove the other copy" (conflicts). Never a default, never a bulk button, always listed in the preview, reported in the summary and balanced by the results-on-file line. Everything else in an import must leave the count equal to before + reported adds.
- **A coach's override is remembered** on the SE entry (`replaced`, `removed`) so a sync does not undo it; both are validated by the sanitiser and preserved by Edit Swimmer.
- **Every bulk button is "<radio name> for all".** A radio's label is a bold name followed by what it does.

---

## 5. v2.13 scope - to agree with the coach before coding (with my recommendations)
Core (confirmed in principle): Swimmers tab (#9), Data tab.

**Coach-requested, from the v2.12.11 UAT (small; do early in v2.13):**
1. **Probable duplicates get the same treatment as Time conflicts (#29):** each radio on its own row (stacked), the choice name in **bold**, followed by what it does (e.g. "**Replace** - move the 1 Jul 2025 entry to the SE date 22 Feb 2025"), consistent with the conflict rows. Keep the radio names matching the "<choice> for all" buttons.
2. **Speed emoji on the conflict note (#30):** a lightning bolt next to "faster" and a turtle next to "slower".
3. **Wording sweep (#28):** the UI still says "PB result(s)" in the SE review; use "swimming results" (the coach's wording) wherever the UI means "swims on file". Update the tests that assert the old strings deliberately. Keep "PB" where it genuinely means a personal best.

**Candidates that fit the same UI work (ask which to include):**
4. **Filter footer counts (#20):** count and group swimmers excluded by the Gender/Age/Squad/name filters. Small; fits the tab work. *Recommend: include.*
5. **Sync message redesign (#23):** a one-line summary plus one collapsible section per note type (a table for skipped rows by record number), built from DOM nodes; adjust the probes that read `#syncStatus.textContent`. *Recommend: include, probably living in the Data tab.*
6. **System Settings / maintenance mode (#27):** extend the existing Settings modal; decide per-browser only vs in the backup bundle (never the token). *Recommend: its own sub-step after Swimmers/Data.* The "wrong script build" warning must stay visible in any maintenance mode.
7. **Merge-duplicates tool** for swimmers that are already duplicates (today: delete the Sheet's record and correct the other's DOB). *Recommend: include if the Swimmers tab gets a per-swimmer actions menu.*
8. **Acknowledge a warning** (#14, unusually fast swims, "no longer in Sheet") so a handled item stops repeating. *Ask.*
9. **Apps Script speed** (Sheets Advanced Service) - only if the coach asks.

---

## 6. Things to know before touching the code
- **Markers:** the SE pure logic sits between `// SE PB REPORT IMPORT — parser + matcher (v2.11)` and `// SE PB REPORT IMPORT — UI orchestration (v2.11)`; tests extract between them, so it may only use `timeToSec`, `ALL_EVENTS` and its own helpers (no `fmtDate`: that is why `seDisplayDate` exists inside the block). Keep the markers.
- **`mergePbs(local, sheet, opts)` returns `{ pbs, seProtected, seSuppressed, stale }`**; `opts.fullHistory` enables stale detection. **`mergeSwimmers()` returns** `added, updated, matched, kept, hidden, removed, seConflicts…, sePbs…, stalePbs, dobChanges, lookalikes, idsRepaired` — or `{ blocked: true, localDupes, sheetDupes … }` when two swimmers share a key (callers must check `blocked`).
- **`swimmerSyncKey()`** = `normaliseNameKey(name)|dob`; `findSwimmersRemovedBySync()` must keep using it and must exclude `pairDobCorrections()` results so the Remove warning equals what is deleted.
- **`fetchWithRetry(url, options, attempts, onRetry, extra)`**: `extra = { retryStatuses, timeoutMs, delayMs }`; the GitHub QT sync passes none (a 404 there is not retried). `SYNC_TIMEOUT_MS` / `SYNC_RETRY_DELAY_MS` are `let` so tests can shorten them.
- **Wizard redraws rebuild `innerHTML`.** Any new scrolling list or `<details>` in the SE wizard needs a `data-keep` key. Tests must re-query `#seImportFileInput` after `showSeImportModal()`.
- `getPbSource(pb)` for source; `getCurrentPbMap(pbs)` for the current PB; `computePbImprovements` is per-day. Every `localStorage` write through `lsSet`; all PB writes through `sanitiseSwimmersData()`.
- Untrusted payload fields (`warnings`, `stats.skippedRows`, `build`) are validated and capped and shown only via `textContent`; keep it that way.
- Mobile CSS conventions (16 px inputs, single-column grids, 40 px heights) apply to anything new; jsdom cannot evaluate `@media`, so use source-text assertions. For anything that depends on browser behaviour, **say it is unverified until the coach tests it** and add a coach test step.
- **Apps Script deployment (this cost two UAT rounds):** paste the code → **Save (Ctrl+S)** → run `testRun` → Deploy → Manage deployments → pencil on the deployment whose URL is in Settings → Version: **New version** → Deploy. "New deployment" gives a new URL and breaks sync (#8). `testRun` runs the editor's code, not the deployed version, so it proves nothing about what the web app serves; the sync message's build suffix does.
- **Results tab:** do **not** delete rows in Data Entry (it leaves `#REF!` in Results); clear them. The script lists skipped rows in `stats.skippedRows`.

---
Added by v2.12.8 to v2.12.11:
- `mergePbs` now returns `{ pbs, seProtected, seSuppressed, seOverridden, stale }`; `mergeSwimmers` adds `sePbsOverridden`.
- **SE conflict decisions:** `keep | incoming | both | incomingx` (`incomingx` = use SE and remove the other copies; `seConflictOthers()` finds them). **Duplicate choices:** `skip | replace | pick:N | all | separate`; a duplicate carries `candidates` (closest first). `seComputeOutcomes` returns `replacedList`; a replace is only honoured when the merge is a clean add.
- `seApplyImport` keeps per-swimmer counters and refuses to write unless `after = before + added + conflictsBoth - duplicatesMerged - othersRemoved`. Summary fields: `added, datesCorrected, unchanged, duplicatesSkipped, conflictsKept, conflictsUpdated, conflictsBoth, duplicatesMerged, othersRemoved, resultsBefore, resultsAfter`.
- Helpers: `countAllResults`, `describeResultsChange`, `findSameTimeRepeats`. Review rows use `.se-row-name`, `.se-row-buttons` and `.se-note-warn`.
- **Source-text test windows go stale:** several probes regex-search a fixed number of characters into a function (e.g. `[\s\S]{0,3000}`); when a function grows, widen the window rather than assume an app bug (this happened three times).

---

## 7. Setting up a fresh workspace and testing
```
git clone https://github.com/asushinski9-netizen/coach-dash.git work && cd work
npm install                 # package.json lists jsdom
python3 make_sample_xlsx.py /tmp/xl      # builds the two sample .xlsx that test_se_import_core.js reads
export SE_SAMPLE_DIR=/tmp/xl/            # also INDEX_FILE, FIXTURE_DIR
./run_all_tests.sh                       # runs every suite, prints per-suite and TOTAL counts
```
**Baseline to reproduce before any edit:** 979 checks, 0 failures (`./run_all_tests.sh` totals them; about 5 minutes: run it as two parallel batches inside ONE call, or per-suite, because commands are capped at ~300 s and background jobs die when the call ends). Fixtures are synthetic since v2.13 (`make_sample_xlsx.py` builds the sample xlsx).

**Logo integrity (mandatory):** `grep "^const LOGO_DATA_URI" index.html | sha256sum` must print `501b76d31b1c5e3d49aaabb39dd4e4ae752d5fb0915a27e49a4ccf72b35b142f`. Record it before editing and re-check before every hand-back. Never retype the base64; edit in place with exact-match replacements (patch scripts assert each old string occurs exactly once).

**Process rules that paid off:** re-run baselines first; write the test first and **show it failing for the right reason** (a randomised property test is worth it: it found cases hand-written tests missed, but check it really fails on the old code); reproduce each reported bug before fixing; test every PB read/write path with a multi-entry swimmer; check disabled/empty/"nothing to do" states; ask the coach before changing tested sync/merge behaviour; **measure before optimising**; run long shell steps with `timeout` and write patch scripts to files; give every build a visible marker (title + script build); say plainly when something is **unverified until the coach tests it** (jsdom has no layout) and add a coach test step.

---

## 8. Files - current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.12.11 | signed off |
| `apps_script_v2.2.4.gs` | 2.2.4 build b5 | signed off, unchanged since v2.12.8; replaces `apps_script_v2.2.3.gs` (older `.gs` files kept for reference; `test_se_field.js` still targets 2.2.3) |
| Test suites (733 checks) | | `test_overview` 74, `probe_pbs_widening` 57, `probe_se_import` 171, `test_se_import_core` 65, `test_se_matching_matrix` 25, `probe_same_day` 85, `test_apps_script_v224` 78, `probe_stage2` 38, `probe_ids` 20, `probe_dobmatch` 31, `probe_v2128` 30, `probe_v2129` 17, `probe_v21210` 27, `probe_v21211` 15 |
| `user_test_script_v2.12.md`, `user_test_script_v2.12.8-to-v2.12.11.md` | | coach scripts; all steps passed |
| docs | v2.12.11 | `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md`, `se-pb-import-and-history-plan.md`, `se-matching-scenarios.md` |
| `package.json` (+ lock), `.gitignore` | | jsdom dependency; ignores `node_modules/` |
| `probe_se_field.js`, `test_se_field.js`, `probe_backup_restore.js` | earlier | not re-run (stale or untouched code paths) |

**Privacy note (v2.13):** all test fixtures are now synthetic (Nic/Nicholas Marlowe, SE # 7000001, a made-up DOB; Bob Baker / Bib Bremer). `john_rows.json` was removed and the Arty fixtures renamed to `nic_rows.json` / `nic_roster.json`. Git history of the public repo still contains the earlier fixtures and the old names in tests/docs: see known-bugs #16. `my_swims.json` and `SwimEngland.xlsx` hold real-looking swim data (names pseudonymised) and are still tracked.

---

## 9. Guidance already given to the coach (keep repeating)
- Download a fresh backup right after any real SE import you intend to keep, and before anything destructive: Restore replaces everything.
- Be careful with the sync's **Remove**: it deletes whole swimmers not found in the Sheet by name + date of birth, with all their PBs (a confirmation lists them). Keep is the safe choice.
- The SE import is forward-accumulating; it cannot bring in a time a swimmer has since beaten.
- **Clear, never delete, rows in Data Entry** (deleting leaves `#REF!` in Results).
- Correcting a mistyped time or date in the Sheet **cannot remove the old value from the dashboard**; the sync lists it ("no longer in the Google Sheet") and the coach deletes it in ✏️ Edit Swimmer.
- A far-faster swim is warned about for up to 60 days; a genuine big improvement will keep being mentioned until it ages out.
- After any Apps Script change: Save, then deploy as a **New version** of the existing deployment, then check the build shown at the end of the sync message.
- **Deploying v2.12.11:** replace `index.html` only (the Apps Script is unchanged, build 2.2.4-b5; the sync message must still show that build). Download a backup first. Steps that merge or remove results are explicit choices and should be tried on a restored copy first.

## 10. Suggested opening prompt for the next session
"Continuing the Coach Dashboard. Read `coach_dashboard_handover.md`, then `known-bugs-and-fixes.md` (open items) and `architecture.md`. v2.12.11 is shipped and signed off. Scope this session: v2.13 'Tabs', starting with the three coach-requested review-screen items in handover Section 5 (#29, #30, #28). Rebuild the workspace, reproduce the 733-check baseline, record the logo hash, then raise the remaining Section 5 questions with your recommendations before writing any code, and write tests first."


---

## 11. State at the end of the v2.13 session (read this first)

**Shipped and signed off (v2.13.1 to v2.13.8):** wording and polish in the SE review (#28/#29/#30: "swimming results", "in the dashboard", "the swimmer's"; stacked bold-named duplicate radios; speed emoji); County/Regional footer counts that account for every swimmer, with a heading naming the active filters and rows showing what the swimmer IS (#20); the 🏊 **Roster** tab (County-style collapsed cards, profile strip, ALL results, flag pills, Sort, Show Former / Show hidden, no Add button); **interactive pies** (desktop) and **five chips** (phone) driven by one selection model with the Gender/Age/Squad dropdowns ("Custom" for mixes); synthetic test fixtures (#16 mostly, #17).

**Getting it onto GitHub (nothing was pushed from the sandbox).** `v2.13-complete-since-v2.12.11.patch` is ONE diff from the v2.12.11 repo state to v2.13.8: `git apply --index` it on a clean checkout of v2.12.11, then commit and push (or copy the delivered `index.html` and the new/changed files). Remember the privacy note: the public repo's history still contains the old fixtures with a child's real name/DOB/SE # (#16): decide whether to rewrite history.

**Remaining v2.13 backlog, in suggested order (one release each, tests first, UAT between):**
1. **Data tab + sync message redesign (#23)** - a one-line summary plus a collapsible section per note type (skipped rows as a table by record number, unusually fast swims, orphaned swims, SE-confirmed notes ...), built from DOM nodes; the probes that read `#syncStatus.textContent` and assert no element children need rewriting to "no injected markup". *Ask the coach which notes annoy them most first.*
2. **Acknowledge warnings (#14)** - a stored fingerprint per handled note (swimmer + event + time + date) so it stops repeating; decide whether it goes in the backup bundle and how to un-acknowledge. Fits naturally inside #23's collapsible sections. *Coach said include it.*
3. **Merge-duplicates tool** - a per-swimmer actions menu on the Roster (also the home for Hide/Show). Must reuse the SE import's "nothing lost" per-swimmer safety check (results after = results before + explicit removals), and be tested with multi-entry swimmers.
4. **Season toggle + Specialty graph (#33) - NEEDS COACH DECISIONS before any code:** (a) when does a season start (1 Sep? the club's year?); does the toggle filter only the results table or also the best/Specialty; is "current" the season containing today? (b) Specialty radar (Free, Back, Breast, Fly, IM, sprint-to-distance colour scale, user-toggleable): what is plotted (share of results, best times against QT / age-group standards, relative strength), which results feed it, where it sits in the card. The reference image is a five-axis filled radar with a Sprint (red) to Distance (blue) legend.

**Out of scope / later:** System Settings and a maintenance mode (#27), Apps Script speed via the Sheets Advanced Service, rename `pbs` to `results` (#19: a schema change, its own session before Progression v2.14), the Progression view (v2.14), mobile sorting is now available (Sort dropdown) so that old limitation is gone.

**Lessons from this session (process):**
- **Commit after every working step.** A sandbox reset lost an uncommitted release and cost several turns to rebuild from the repo + patches + exported files.
- **Tests cannot see layout.** Three coach-found defects were visual or wording ones my tests passed (an unclosed `<div>` that jsdom silently repaired; a footer line that read as a fact about the swimmer; "on file" / "your" wording). Every change to rendered HTML gets a balanced-tags / sibling-structure check, and wording is read aloud as a sentence before it ships.
- **Beware blunt search-and-replace** (it once rewrote a GitHub username inside the QT sync URLs; caught by diffing).
- **Don't re-run the whole suite after every tweak:** run the affected suites, and the full set once per release.

## 12. Suggested opening prompt for the next session
"Continuing the Coach Dashboard. Read `coach_dashboard_handover.md` (especially Section 11), then `known-bugs-and-fixes.md` and `architecture.md`. v2.13.8 is shipped and signed off (979 checks). Rebuild the workspace (clone the repo, apply `v2.13-complete-since-v2.12.11.patch` if it is not already pushed), run `./run_all_tests.sh` in batches to reproduce the baseline, record the logo hash, and commit after every step. Scope this session: [pick: Data tab + sync message redesign (#23) with acknowledge warnings (#14) / merge-duplicates tool / the #33 decisions]. Raise questions with recommendations before writing code, then tests first."
