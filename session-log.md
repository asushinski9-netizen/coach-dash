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

## Files — current state (v2.11)

| File | Version | Description |
|---|---|---|
| `index.html` | v2.11 | Dashboard (~5,180 lines): SE import, `mergePbs` protections, Remove confirmation, UX fixes |
| `apps_script_v2.2.3.gs` | v2.2.3 | Unchanged since v2.9 (v2.12 will replace it) |
| `test_overview.js`, `probe_pbs_widening.js` | v2.11 | Existing suites (the latter updated for `mergePbs`'s new return shape) |
| `probe_se_import.js` | new | Wired-wizard probe, 171 checks |
| `test_se_import_core.js` | new | Parser/matcher/reader tests extracted from `index.html`, 65 checks |
| `test_se_matching_matrix.js` | new | Pins every matching scenario; `--table` regenerates the doc table |
| `se_sample_rows.json`, `arty_rows.json`, `swimmers_pb__3__-_Copy.json` | fixtures | Rows read from real exports / a real roster — **personal data; keep out of the public repo** (Open Issue #16) |
| `user_test_script_v2.11.md` | v2.11 | Coach-facing manual test script (UAT passed) |
| `se-matching-scenarios.md` | new | What auto-matches / is suggested / is skipped, and v2.12 questions |
| `se-pb-import-and-history-plan.md` | v3 | Plan, corrections, proposed roadmap |
| `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `project-brief.md`, `README.md`, `coach_dashboard_handover.md` | v2.11 | Updated this session |
| `probe_se_field.js`, `test_se_field.js`, `probe_backup_restore.js`, `user_test_script_v2.9/2.10.md` | earlier | Unchanged |
