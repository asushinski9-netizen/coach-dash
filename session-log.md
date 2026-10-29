# Coach Dashboard — Session Log

## v1.0 — June 2026
Built in a single Claude chat session. See `known-bugs-and-fixes.md` for the v1.0 bug list.

## v2.1 through v2.9
Unchanged from prior versions of this file (git history holds the full turn-by-turn text): v2.1 security/bug patch; v2.2 Google Sheets sync; v2.2.1 regression + security fix; v2.3 GitHub QT sync + Manage Data redesign; v2.4 diagnostics + stored-XSS fixes; v2.5 Overview tab; v2.6 full codebase review; v2.7 two more mobile fixes; v2.8 Backup & Restore; v2.9 SE # field end to end + mobile/UX fixes + UAT.

## v2.10 — September 2026 (condensed)
`pbs` schema widening (many dated entries per event+course), per-PB `source`, `mergePbEntry()` / `resolvePbEntryConflict()` implemented to the locked spec, live current-PB helper, Hot Right Now = recent improvements. A real bug was found and fixed mid-session: `mergePbs()` keyed by event+course silently wiped manually entered PBs on a merge (re-keyed to event+course+date). Open Issue #7 (stale test fixture) fixed. UAT passed; the logo was found corrupted by a hand-retyped restore and replaced from the v2.9 file.

---

## v2.11 — October 2026 — SE PB Report Import

**Scope, agreed up front:** the SE PB report import (plan Sections 2, 4, 5) and nothing from v2.12. During UAT the coach asked for several related changes that were done in-session because they were defects or direct consequences of the feature (Section "UAT rounds"); items that are new scope were moved to v2.12 (below).

### Setup and decisions
- The session began with the app files not on disk (only the two sample `.xlsx` had arrived); rebuilding `index.html` from text would have meant retyping the base64 logo, so the work waited for the real files. The `LOGO_DATA_URI` line was hashed before any edit and re-checked at every hand-back (always identical to the v2.10 file).
- Baselines re-run first: `test_overview.js` and `probe_pbs_widening.js` clean.
- Four decisions were raised before coding and agreed: **(1) reading `.xlsx`** — SheetJS rejected (its last npm release has known CVEs and the patched build was unreachable; the file is untrusted input about minors) in favour of a small native reader with hard limits; **(2) name matching** — a shared normalised key for the import, with sync deliberately left unchanged (Open Issue #10 stays open); **(3) UI** — its own modal launched from a Manage Data card, keeping `#dataModalStatusDock` last; **(4) files** — one picker accepting an SC and an LC file together.
- Real sample exports were checked before relying on the plan: a meet name of 36 characters contradicted the "always 30" claim.

### Build
`readXlsxRows` (zip walk, inflate with real-byte cap, shared strings, first sheet), `parseSeSheetRows` (row-shape classification), `combineSeParsedFiles`, `matchSeSwimmer`/`matchAllSeSwimmers` (tiered), the wizard (`seRender*`, `seApplyImport`), and a 25-scenario matching test. Every write calls the existing `mergePbEntry()`/`resolvePbEntryConflict()` and then `sanitiseSwimmersData()`. Logic was developed as standalone files, tested against the real exports, spliced into `index.html` between marker comments, and the standalone copies were retired in favour of tests that extract from the shipped file (no duplicate source to drift).

### UAT rounds (coach feedback → outcome)
1. **Round 1:** parser rejected `(Open/Boy 12)` headers (~290 "skipped" rows); detail list capped at 30; em-dashes in guidance; unclear wording; "what does the tick do"; scroll jump; Arty/Artyom auto-match invisible; a same-surname swimmer wrongly "unmatched"; DOB format; disabled button looked live; no list of what would be added; Add-PB button far away; question whether a replaced date can come from SE. → all fixed; **Replace date** added as a third probable-duplicate choice; the matcher's exclusion of candidates holding a different SE # was a real false-negative bug.
2. **Round 2:** scroll still jumping; asked for bulk duplicate buttons; review undercounted adds vs apply (2 vs 4); Add-PB button into the sticky footer. Hand-checking the coach's Arty files found the apply numbers right and the preview wrong → `seComputeOutcomes()` shared by preview and apply (all 27 choice combinations tested for agreement).
3. **Round 3:** coach pointed out a replace is an update, not a new PB. The summary had summed to 16 for 15 results; I had earlier defended the double count as intentional, which was wrong. → replace is an update; one bucket per entry.
4. **Round 4:** after a replace-all import, a Google Sheet sync brought the old made-up-date rows back (Keep and Remove alike; the setting never touched PBs). Reproduced with the coach's real files → `mergePbs` second protection rule (suppress same-time/different-date copies of SE-confirmed swims).
5. **Round 5:** scroll jump persisted for radios. Two earlier fixes had protected only the outer modal; reproducing it showed the inner lists (and `<details>`) were being reset → `data-keep` save/restore. Coach also asked for clearer Keep/Hide/Remove text; I corrected their summary (Remove deletes whole swimmers *and their PBs*) and added a **Remove confirmation** with a possible-rename hint.
6. **Round 6:** Apply stayed live with nothing to import → enabled only when applying would change something.
7. **Final:** all test-script steps passed. Two observations deferred to v2.12: the Suggested-match rules, and Google Sync only importing the fastest result per event+course.

### Honest notes on what went wrong along the way
- My first em-dash sweep covered only the script block and missed the static card; it was reported twice.
- Scroll was "fixed" twice on the strength of tests that could not reproduce the real cause; only the third fix started from a reproduction. Recorded as Open Issue #15 (don't claim a browser-dependent fix without a reproduction or an explicit "unverified").
- I hand-counted the Arty duplicates wrongly (misread a date) before computing them with the real code.
- I found, while documenting, that the confirm-tick text claims an SE # is never changed (a blank one is filled) — logged as #12 rather than altered after sign-off.
- The environment's working directory was lost mid-documentation; all deliverables survived in the outputs folder, the workspace was rebuilt from them and every suite re-run before documenting.

### Testing
392 checks, all passing: `test_overview.js` 74, `probe_pbs_widening.js` 57, `probe_se_import.js` 171, `test_se_import_core.js` 65, `test_se_matching_matrix.js` 25. Backup & Restore re-verified to need no change. Logo byte-identical.

### What did NOT happen
No Apps Script changes. No dedicated Swimmers tab. No change to date-of-birth handling, squad, or County/Regional behaviour. No change to the Google Sync key/normalisation.

### Hand-off
Docs written after UAT: `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md`, `se-pb-import-and-history-plan.md` (v3), new `se-matching-scenarios.md`, and `coach_dashboard_handover.md` rewritten for v2.12. The re-ordering of the roadmap (Swimmers tab moves from v2.12 to v2.13; Apps Script full history becomes v2.12; progression is v2.14) was confirmed by the coach at the end of the session.

---

## v2.12 — October 2026 — Data foundations

**Scope, agreed up front:** (a) Apps Script emits every dated result; (b) revisit the suggested-match rules and wording; (c) small items. Questions with recommendations were raised first; the coach's answers changed the design (heats and finals on one day are routine, so "fastest wins" was dropped for a same-day-swims model).

### Setup
The files arrived as text, not on disk; the repo was cloned from GitHub and the baseline reproduced (392 checks; the original Bob/Bib sample `.xlsx` were not supplied, so `test_se_import_core.js` ran against workbooks rebuilt from `se_sample_rows.json`). Logo hash recorded and re-checked at every hand-back.

### Build and UAT (Stage 1: every swim)
Tests written first and shown failing (19 failures against the old code), then the script and dashboard. Round 1 findings: sync slow then a bare HTTP 404; an orphaned swim after a Sheet date edit; the unusually-fast warning picked only one of a heat and a final; record numbers wanted in warnings. Round 2: orphan note and warning still not seen, **because the deployed web app was an older script build than `testRun` showed** (pasted but not saved before deploying). That led to a build marker in every sync message and a loud mismatch warning (v2.12.2/3). Further rounds: skipped Results rows surfaced by record number with plain-language reasons (the coach's `#REF!` and wrong-column entries); warnings now flag every far-faster swim; the Results read was optimised by measurement (see below).

### Stage 2 and bugs found in UAT
Shared name key + collision stop; matcher shows both DOBs and a day/month-swap hint; accent folding; wording fixed; test paths configurable. UAT then found **two swimmer records sharing one id** (the Apps Script builds `id` from the Sheet name), so Edit showed the same record for both and **Delete removed both**; reproduced, fixed with `ensureUniqueIds` (repair on load), and the underlying gap (a corrected DOB makes a duplicate) fixed with DOB-aware matching (design approved by the coach). A stale Manage Data status line was fixed.

### Honest notes on what went wrong along the way
- I did not bump the page title for the first v2.12 build, so a stale cached file and the new one looked identical; the coach had to report it.
- Two performance theories were wrong until measured: "one timezone call per row" (processing was 0.7 s; the read was 10.6 s) and "reading fewer columns helps" (the cost is per row; the column effect is mild). The final design (chunked forward read) came from the coach's per-step timings. Sync went from 17-18 s to 8-11 s; `testRun` from 12.9 s to 6.5 s.
- My tests did not cover "an unmatched Sheet swimmer gets the same id as a kept dashboard swimmer", so the duplicate-id data-loss bug reached UAT. Added (`probe_ids.js`) along with the missing standing rule: look for any lookup-by-key that assumes uniqueness.
- Several of my own test-harness mistakes (Date realm across the vm sandbox, equality helpers that ignored new timing fields, an escaping slip in a patch script that hung a command for 5 minutes) cost time but not correctness.
- `mergePbEntry` is a "locked spec" function; it was extended additively and this is recorded as a deliberate decision.

### Behaviour changed on purpose (existing checks updated)
`probe_pbs_widening.js` three checks (a same-date different time is now added beside the existing swim, and SE protection is directional); `test_se_matching_matrix.js` scenario T (accents: needs-review → likely); `probe_se_import.js` the SE # wording check.

### Testing
644 checks, all passing: `test_overview.js` 74, `probe_pbs_widening.js` 57, `probe_se_import.js` 171, `test_se_import_core.js` 65, `test_se_matching_matrix.js` 25, `probe_same_day.js` 85, `test_apps_script_v224.js` 78, `probe_stage2.js` 38, `probe_ids.js` 20, `probe_dobmatch.js` 31. Coach UAT (`user_test_script_v2.12.md`) passed every step.

### What did NOT happen
No Swimmers/Data tabs, no System Settings, no `pbs` rename, no merge-duplicates tool, no change to the SE import's file handling. Backup & Restore needed no change.

### Hand-off
Docs updated: `coach_dashboard_handover.md` (rewritten for v2.13), `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `se-matching-scenarios.md`, `se-pb-import-and-history-plan.md`, `project-brief.md`, `README.md`. Open backlog: known-bugs #14, #19, #20, #23, #27.

---

## Files — current state (v2.12)

| File | Version | Description |
|---|---|---|
| `index.html` | v2.12.7 | Dashboard: same-day swims, robust sync, matching/identity fixes |
| `apps_script_v2.2.4.gs` | 2.2.4 build b5 | every dated result, warnings, stats, chunked read (replaces v2.2.3) |
| `probe_same_day.js`, `test_apps_script_v224.js`, `probe_stage2.js`, `probe_ids.js`, `probe_dobmatch.js` | new | v2.12 suites (252 checks) |
| `test_overview.js`, `probe_pbs_widening.js`, `probe_se_import.js`, `test_se_import_core.js`, `test_se_matching_matrix.js` | updated | existing suites (392 checks) |
| `user_test_script_v2.12.md` | v2.12 | coach script (UAT passed) |
| `coach_dashboard_handover.md`, `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `project-brief.md`, `README.md`, `se-pb-import-and-history-plan.md`, `se-matching-scenarios.md` | v2.12 | updated |

---

## v2.12.8 - October 2026 - post-deployment fixes (SE import data safety)

**Trigger.** The coach deployed v2.12.7, ran a full real-data cycle (initial Sheet sync on an empty dashboard, SE import, re-review, re-sync, re-review) and reverted to v2.11 after noticing counts that did not add up. Their traced notes were reproduced in jsdom with synthetic data before any code changed.

**Root causes (confirmed by reproduction):**
1. `seFindProbableDuplicateAdds` flagged an SE swim as a "probable duplicate" whenever ANOTHER entry had the same time on a different date, even if the SE swim was already on file exactly. Choosing **Replace** then removed that other entry while the merge was a no-op: a silent deletion (Leila 34.80), counted as "unchanged", so the 201 added vs +200 events gap. The same logic made Nicole's re-review keep flagging a duplicate with nothing to import.
2. Which same-time entry was offered for replacement was simply the first found (arbitrary).
3. Item 4 ("7 swimmers updated", +9 results): after the SE import set a different time on a date ("Use SE report"), the next Sheet sync still carried the old Sheet time. v2.12's directional rule (slower same-day Sheet swim = plausible heat) re-added it. Together with the one record Leila lost and the sync re-added, this accounts for the +9 and the 7 updated swimmers.

**Fixes (tests written first and seen failing for the right reason):**
- Fix 1: no probable-duplicate flag when anything is already on file for that event+course+date.
- Fix 2: Replace only ever swaps one entry for the SE one; if the merge is not a clean add nothing is removed; the closest-dated same-time entry is offered; an SE-sourced entry is never offered; a per-swimmer safety check refuses to write if the result count would not rise by exactly what was added.
- Fix 3: "Use SE report" remembers the replaced Sheet time on the SE entry (`replaced`), and Sheet sync does not re-add it (reported as an informational note). New third choice **Keep both (heat and final)** adds the SE swim beside the existing one.
- Count line: sync, SE import summary and Manage Data show the swimming results on file (before -> after), the import summary flags any mismatch.
- Same-time repeats (same event, course and time on several dates) are listed in the SE review as possible duplicates; never deleted.

**Testing:** 674 checks, 0 failures (644 + 30 in new `probe_v2128.js`, including a 1,350-case randomised check that no choice combination can lose a result). One expectation changed deliberately (page title v2.12.8). Apps Script unchanged (still 2.2.4-b5). Logo hash unchanged.

**Honest note:** the property test I first wrote passed against the buggy code (it rarely generated the failing pattern and the Leila test never clicked Replace); both were tightened until they failed on the old code. The item 2 gap (201 vs 200) was explained only by inference from the reproduction, not by the coach's original files.

---

## v2.12.9 - October 2026 - several same-time entries on file

**Trigger.** While preparing to test v2.12.8 the coach reproduced two edge cases from real data and reported them before testing. Both were reproduced in jsdom first.
- **Nicole:** two on-file 43.50 entries (1 Jul and 28 Sep 2025), SE says 22 Feb 2025. The duplicate row named only the closest on-file date, so the second entry was invisible there and could not be chosen or merged.
- **Amy:** two on-file 3:13.52 entries (29 Nov 2025, 5 Jul 2026), SE says 3:11.36 on 5 Jul 2026. Result was correct (a same-date time conflict; the 29 Nov swim correctly stays) and stable on re-sync, but the conflict row gave no hint that the same time is also on file for another date.

**Changes (tests first):**
- A duplicate now carries all candidate entries (closest first). With two or more, the row lists every on-file date and offers: Skip / Replace the closest / Replace each other entry / **Replace all N (merge into the SE swim)** / Import separately. Single-candidate rows are unchanged.
- "Replace all" is the only path that can reduce a swimmer's result count. It is explicit, shown in the live preview ("remove N duplicate on-file result(s)"), listed with the dates, reported in the summary (`duplicatesMerged`) and balanced in the results-on-file line. The per-swimmer safety check allows exactly that amount and nothing else. SE-sourced entries and other events are never removed.
- Conflict rows add "The on-file time X is also on file on <dates>" when the time repeats on another date.

**Testing:** 691 checks, 0 failures (674 + 17 in new `probe_v2129.js`, including a 2,160-case randomised check that the count only changes by reported adds, kept-both and explicit merges, and that no existing SE-sourced entry is ever removed). Two existing expectations updated deliberately (page title; a stale source-text window in `probe_se_import.js`). Apps Script unchanged (2.2.4-b5). Logo hash unchanged.

---

## v2.12.10 - October 2026 - Amy's case: remove the other copy; consistent names

**Trigger.** The coach tested the conflict row for a swimmer with the same time (3:13.52) on two dates and an SE swim 3:11.36 on one of them. The three existing choices behaved correctly, but (1) the row never said what each choice would do to the swimmer's results, (2) there was no way to replace both 3:13.52 copies, and (3) bulk button names did not match the radio names ("Keep all" vs "Keep existing"; "Replace all" the button vs "Replace all N" the merge radio).

**Changes (tests first, 20 red then green):**
- Every bulk button is now "<radio name> for all": conflicts "Keep existing / Use SE report / Keep both for all"; duplicates "Skip / Replace / Import separately for all". The merge radio is "Merge all N into the SE swim" (no clash with a button).
- Each conflict radio states its outcome (e.g. "Use SE report - replace 3:13.52 with 3:11.36 (the 29 Nov 2025 entry stays)"). A faster SE time is called out ("2.16s faster than the best on file").
- New fourth conflict choice, offered only when another non-SE copy of the on-file time exists: "Use SE report and remove the other 3:13.52 (29 Nov 2025)". Explicit, no bulk button (same rule as the merge), shown in the preview, reported in the summary (`othersRemoved`), balanced in the results line and allowed by the per-swimmer safety check. The SE entry stores `removed: [{date, time}]` so a later sync does not re-add the removed row (counted with the overridden rows). Sanitised and preserved by Edit Swimmer.

**Why not auto-remove:** the other copy may be a genuine earlier swim; only the coach knows which date is real, and removing it also erases the progression to the new best.

**Testing:** 718 checks, 0 failures (691 + 27 in `probe_v21210.js`, with a 1,440-case randomised check). Expectations changed deliberately: page title, one button-label check, and two stale source-text windows in `probe_se_import.js`. Apps Script unchanged (2.2.4-b5). Logo hash unchanged.

---

## v2.12.11 - October 2026 - review screen layout and notes

**Trigger.** Coach feedback from a screenshot of the Time conflicts list after v2.12.10: longer bulk-button labels made long swimmer names wrap; the Probable duplicates section had an explainer but Time conflicts did not; Jager's row had no orange note; and a Nicola-type case (two same-time entries on file plus the SE swim) deserved the same highlight.

**Root cause of the missing Jager note:** the orange note was only produced when the SE time was FASTER than the best on file (`gain > 0`). Jager's SE time (30.75) was slower than his on-file 30.37, so no note appeared - and using the SE report there would make his time worse, which is exactly when a warning matters.

**Changes (tests first, 12 red then green):**
- The swimmer's name always has its own full-width row (`.se-row-name`, long names break), the bulk buttons sit on the row below (`.se-row-buttons`; the row may wrap as a whole, a button's own label never wraps via `white-space: nowrap`). Both Time conflicts and Probable duplicates.
- New explainer note under "Time conflicts".
- Orange note (`.se-note-warn`) for EVERY time difference: faster ("The SE time is Xs faster than the best on file (Y), so Keep existing leaves your best at Y") and slower ("...Xs slower than the best on file (Y)"; when the conflicting on-file swim is the best, it adds "Using the SE report would make your best time on file slower").
- Orange note on Probable duplicates when two or more same-time entries are on file ("2 entries on file have this time (dates) and the SE report has it on ...; most likely the same swim recorded more than once. Merge keeps just the SE one"). The existing "also on file on <dates>" line on conflicts is orange too.

**Testing:** 733 checks, 0 failures (718 + 15 in `probe_v21211.js`). Page title expectation updated deliberately. Apps Script unchanged (2.2.4-b5). Logo hash unchanged.

**Honest note:** jsdom has no layout engine, so the checks prove the structure (name row first, buttons in their own row, the CSS rules present) but NOT how it looks on a real narrow screen. Per known-bugs #15 this is unverified until the coach checks it; the test script has explicit steps.

**Coach UAT of v2.12.8 to v2.12.11:** all steps of `user_test_script_v2.12.8-to-v2.12.11.md` passed (including the real-screen layout steps on desktop and phone). Future requests logged: stacked, bold, outcome-worded radios on Probable duplicates (#29), lightning/turtle emoji on the conflict note (#30), and the "swimming results" wording sweep (#28). Package prepared for GitHub; fixtures with a personal-looking name held back pending a privacy check (handover Section 8).
