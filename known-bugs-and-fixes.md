# Coach Dashboard — Known Bugs & Fixes (v2.12)

*Older sections (v2.7 and earlier, and the detail of v2.8–v2.10) are condensed here; the full earlier text is in git history of this file (the v2.10 copy). Everything below the Open Issues list that is new is under "Added in v2.11".*

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script as `${syncUrl}?token=${token}` (risk: browser history / access logs). Correct fix is a `doPost` reading the token from the body — a coordinated change to the Apps Script. **Not fixed.** Natural to fold into the v2.12 Apps Script change if the coach wants it.

### 2. Single shared sync token, not per-coach
One `ACCESS_TOKEN` in Script Properties, shared by every coach. Documented accurately in Settings. Deliberately not addressed.

### 3. Apps Script quota
Daily execution quota (~20,000 calls personal accounts); no rate limiting. Low risk today. Checked in v2.12: the payload with every dated swim is ~66 KB for ~810 swims (~1 MB for 14,000), and a `doGet` takes ~6 s; still low risk.

### 4. GitHub QT sync has no *offline* handling
Unchanged. Not relevant to v2.11.

### 5. Manual-upload/sync validation still isn't exhaustive
Still not validated: swimmer `id`, `squad` value normalisation, QT `age` strings against the valid set. Unchanged.

### 6. ~~SE PB report import~~ — SHIPPED in v2.11
See "Added in v2.11". (Roadmap: `se-pb-import-and-history-plan.md`.)

### 7. ~~`test_overview.js` stale fixture~~ — fixed in v2.10.

### 8. (Operational) Redeploying the Apps Script as a NEW deployment silently breaks sync
A new deployment gives a new URL; the dashboard keeps the old one in Settings. **Will matter for v2.12's Apps Script change** — redeploy as a new *version* of the existing deployment, or update Settings. Operational note from v2.11 UAT: a one-off "Fetching… then Failed to fetch" was reported and cleared by itself; the sync code (`startSync`, `mergeSwimmers`, `mergePbs`, `fetchWithRetry`, `setSyncStatus`) was verified byte-identical to v2.10 at that point, so it was a transient network/Apps Script issue.

### 9. (Feature request) Dedicated "Swimmers" tab for basic profile data
Independent of County/Regional's PB/QT-driven filtering. **Moved from v2.12 to v2.13 (confirmed by the coach)** — see plan Section 7.2.

### 10. (FIXED in v2.12) Swimmer matching differed between features
*v2.12: `swimmerSyncKey` now uses `normaliseNameKey` (same as the SE import), and a sync or upload-merge STOPS before changing anything if two swimmers would share one key (`findKeyCollisions`, also guarded inside `mergeSwimmers`). The text below is the original description.*
- Google Sheets sync matches by `swimmerSyncKey` = lower-case + trimmed name + `|` + dob. An internal whitespace difference, a nickname, or a rename in the Sheet means no match: the Sheet's copy is added as a new swimmer and the local one is "local-only".
- The SE import uses `normaliseNameKey` (NFKC, lower-case, collapse whitespace), plus a tiered matcher.
- **Risk:** the sync's **Remove** option deletes dashboard swimmers not found in the Sheet *by that key*, including manually added ones, along with all their PBs (manual and SE-imported). **Mitigated in v2.11:** Remove now shows a confirmation listing exactly who would be deleted (same key function, tested equal to the actual removal set), with a "possible rename" hint when the Sheet has the same dob+gender under another name; help text explains Keep/Hide/Remove.
- **Decision for v2.12:** share one normalised key across sync and import? (A behaviour change to sync: two local swimmers that collapse to one key need a collision check so nobody is silently dropped.)

### 11. (NEW) Google Sync only brings in the fastest result per event+course
`buildPayload()` in `apps_script_v2.2.3.gs` keeps one entry per swimmer+event+course (`if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec)`). A slower swim added later is never imported; two swims added before a sync import only the faster. Designed for "today's PB", but now inconsistent with SE import, which builds dated history, and a blocker for progression insights. **Headline of v2.12** (plan Section 7). The dashboard side already copes with many dated entries per event+course.

### 12. (FIXED in v2.12) "Never changes … SE #" wording
*Reworded: ticking never changes Name, Date of Birth or Gender, and fills in the SE # only if the dashboard has none.*
The note above Suggested matches says ticking never changes Name, DOB, Gender or SE #. Not true for SE #: if the dashboard swimmer has none, confirming fills it in from the SE report (the review note says "fill in the SE # for N swimmer(s)" and the summary lists them). An existing SE # is never overwritten. Fix the wording in v2.12.

### 13. (PARTLY DONE in v2.12) Suggested-match rules to revisit
*Done: both DOBs shown with a day/month-swap hint (and listed in the import summary), accent folding for first-name similarity. Left as is, deliberately: hyphenated surnames, reversed order, "pick one", excluding an auto-match. See `se-matching-scenarios.md` section 4b.*
Requested by the coach. Current behaviour for 25 scenarios, and ten specific observations (SE # outranks name; DOB-mismatch suggestions don't show both dates; DOB typo = unmatched; gender handling inconsistent; prefix-only first-name similarity and no accent folding; strict surname suffix rule; no "pick one" for two candidates; no per-swimmer exclude on an auto-match; SE # collisions; name-key divergence) are in **`se-matching-scenarios.md`**, pinned by `test_se_matching_matrix.js`.

### 14. (NEW) "Sheet rows suppressed" note repeats until the Sheet is corrected
Rule 2 of the SE protection (`seSuppressed`) keeps replaced made-up-date rows from being re-added, and says so on every sync while those rows remain in the Sheet. There is no "acknowledge/ignore". Heuristic limit: two genuinely separate swims with an identical time on different dates would have the later Sheet row suppressed (cannot change a current PB). Only `source:"se"` entries ever trigger it.

### 15. (NEW) Some UI behaviour cannot be verified in the test environment
jsdom has no layout, `@media`, native scroll or focus-loss handling. The inner-list scroll reset *was* reproducible there (new elements start at 0) and is regression-tested, but earlier attempts "passed" jsdom and still failed in a real browser. Rule: for any UI change that depends on browser behaviour, say plainly that it is unverified until the coach tests it, and add a coach test step.

### 16. (NEW — PRIVACY) Real personal data in test fixtures and a UI placeholder
The Arty fixtures (`arty_rows.json`, `swimmers_pb__3__-_Copy.json`, the real sample `.xlsx`) and the new tests contain a real child's name, date of birth and SE #, and the "SE #" input placeholder (`e.g. 1745801`, since v2.9) matches a real number. The repo serving `county_qt.json`/`regional_qt.json` is public on GitHub. **Do not commit these to the public repo as-is.** v2.12: replace with synthetic data and a synthetic placeholder (and check git history of anything already committed).

### 17. (NEW) Test tooling assumptions
`test_se_import_core.js` hard-codes `/mnt/user-data/uploads/` for the real sample `.xlsx` and needs `python3` + `openpyxl`; the probes read fixtures from their own folder. A fresh workspace needs `npm install jsdom`. v2.12: make paths configurable / check fixtures in under a `fixtures/` folder (anonymised).

### 18. (NEW, by design) SE import limits
`.xlsx` only (no legacy `.xls`); 5 MB file / 20,000 rows caps; SE report is current-best-only so it cannot backfill history (stated in the UI).

### 19. (NEW, future) "pbs" is no longer an accurate name
Since v2.10/v2.12 the `pbs` array holds every dated swim (heats, finals, non-PB swims), not just personal bests. The name is baked into the swimmer JSON, backup files, the Apps Script payload and several UI texts (e.g. the Google Sync Keep/Hide/Remove help text, "PB" columns). Raised by the coach in v2.12 UAT. Proposal: rename in the schema (e.g. `results`/`swims`) with a one-way migration on load and in `sanitiseSwimmersData()` (accept both names, write the new one), bump the backup `version`, and sweep UI wording (PB = "current best" only where that is what is meant). Do it as its own schema-version change, not mixed into another feature; natural fit just before the v2.14 Progression work.

### 20. (NEW, future) County/Regional footer "not shown" counts ignore most filters
`renderTab()` lists excluded swimmers only for hidden, Former Swimmer and the Status filter (swimmers with no rows after Status/Course/Stroke are diagnosed by `diagnoseZeroRowSwimmer`). Swimmers removed by the Gender, Age Group, Squad and name-search filters are dropped silently in `visibleSwimmers`, so "N swimmer(s) shown" and the "not shown (click for why)" text do not reflect them. Raised by the coach in v2.12 UAT. Fix idea: count and group them by the filter that removed them (reuse the existing details list). Natural fit for v2.13 "Tabs".

### 21. (FIXED in v2.12) Edited/deleted Sheet swims lingered on the dashboard silently
Because the Sheet only ever added to the dashboard, a swim edited or deleted in the Sheet stayed behind. With full-history payloads (script v2.2.4+, payload 2.4) `mergePbs()` now reports Sheet-sourced swims the Sheet no longer lists (never auto-deleted; a hint says if the Sheet now has it under another date or time). Not reported for manual/SE entries, undated entries, older payloads, or manual file uploads.

### 23. (NEW, future) The Google Sync message has become too busy
The sync result is one wrapped text block, and v2.12 added several notes to it (script build, skipped Results rows, unusually fast swims, swims no longer in the Sheet, SE-confirmed differences, QT/sanitise notes...). Raised by the coach in v2.12 UAT. Proposal: a short summary line plus one collapsible section per note type (a table where it helps, e.g. skipped rows by record number), built from DOM nodes rather than one string. Fits v2.13 "Tabs"/Data tab. Note when doing it: the probes read `#syncStatus.textContent` and assert it has no element children (hostile-text tests) - adjust those to check for no injected markup instead.

### 24. (FIXED in v2.12.6) Two swimmer records could share one id; Edit showed the wrong record and Delete removed both
Found in v2.12 UAT (V3 follow-up). The Apps Script derives a Sheet swimmer's `id` from the Sheet name alone, so when a sync cannot match a dashboard swimmer (a date of birth differs) the Sheet's swimmer was added with the SAME id as the kept dashboard one. Edit and Delete look up by id: both Edit dialogs showed the first record, and Delete removed both (reproduced: one Delete left 0 records). Fix: `ensureUniqueIds()` runs on load (repairing data already affected, and saving), after every merge, upload-replace and backup restore; the first non-local record keeps the id. `probe_ids.js` (20 checks).

### 25. (FIXED in v2.12.7, design approved by the coach) A corrected date of birth made a duplicate swimmer on the next sync
*Implemented as proposed below: `pairDobCorrections()` + `dobsLookCorrected()`; `mergeSwimmers()` reports `dobChanges` and `lookalikes`; the sync message shows both (the DOB note is informational, the same-name warning asks the coach to check); the Remove warning no longer lists a DOB-corrected swimmer. Manual file upload-merge never pairs this way. `probe_dobmatch.js` (31 checks). Still open: there is no tool to merge two records that are ALREADY duplicates (clean up by deleting the Sheet's record, then correcting the other's DOB - see the v2.12 test script W2).*
The sync identifies a swimmer by normalised name + date of birth. If the DOB is corrected in the Sheet (or edited on the dashboard) the two sides stop matching: the Sheet's swimmer is added as new and the old one is kept as "local-only", with the PBs split between two records. The SE import's DOB-mismatch summary tells the coach to fix the Sheet, which leads straight into this. Proposal: when a Sheet swimmer has no name+DOB match but an unmatched dashboard swimmer has the same Sheet-derived id and the same normalised name, and the DOBs differ only slightly (one of year/month/day, or a day/month swap), treat them as the same swimmer: the Sheet's DOB wins (it is authoritative), PBs are kept, and the sync message reports "date of birth changed for X (was ..., now ...)". Larger differences keep today's behaviour but warn when a same-name, different-DOB pair results. Never match on name alone (a new child with a former swimmer's name must not inherit their PBs). There is also no tool to merge two duplicate records.

### 26. (FIXED in v2.12.6) Old Manage Data status line lingered when starting a Sync or an SE import
"Cleared all swimmers" stayed at the bottom of the Manage Data modal through a later Google Sync or SE import (those open on top of Manage Data, which only cleared its message when closed). Starting either now clears the old status and error line.

### 27. (FUTURE) System Settings modal and a maintenance/diagnostics mode
Raised by the coach in v2.12 UAT: one place for "under the bonnet" and look-and-feel options, including a maintenance mode controlling whether the Apps Script build / history-check suffix is shown in every sync status. Notes: extend the existing Settings (sync URL/token) rather than add a second modal; settings are per browser (localStorage) so decide whether they belong in the backup bundle (never the token). The "wrong script build" warning must stay visible regardless of the mode (it is a problem report, not routine diagnostics). Candidates: diagnostics on/off (build, history check, timing), show/hide County/Regional/editor tabs, colours/theme, logo (validated image stored as a data URI; the built-in logo's hash rule is unaffected), default Keep/Hide/Remove, default Hot Right Now days and Bubble margin, retry/timeout values, storage-size meter, backup reminder. Fits v2.13 alongside the Tabs/Data tab work.

### 22. (MITIGATED in v2.12) Intermittent "HTTP 404" on Sheets sync, slow to fail
Reported in v2.11 and v2.12 UAT. Root cause not established (Google Apps Script web apps can be slow or briefly unavailable; the script itself ran fine in the editor). In v2.12 the script reads far fewer blank rows (3,174 of 3,999 in the coach's Sheet; payload build was ~13 s), and the dashboard retries 404/5xx/timeouts up to 3 times (90 s per attempt) and shows a plain-language message. Round 2/3 UAT: the Results step took 7.3 s then 11.3 s (10.6 s of it READING the Sheet; processing only 0.7 s), so the per-row timezone call was NOT the cause (it is cached anyway). Round 4 numbers showed the cost is ~1.7 ms PER ROW whatever the column count (scan 3,997 rows 7.3 s, values 830 rows 1.4 s, colours 830 rows 1.5 s; the very first build ~8,000 row-reads ~ 13 s), so the narrow-column read (b4) saved nothing and was reverted in b5. b5 finds the last data row by reading forward in 250-row chunks and stopping after 2 blank chunks (~1,500 rows read instead of ~5,700; modelled 10 s -> 4 s, unmeasured). Known limit: a gap of more than 500 consecutive blank rows in the middle of the Results tab hides the rows below it. Further option if needed: the Sheets Advanced Service. Also (round 3): the deployed web app was an older build than `testRun` showed (code pasted and deployed without saving, or a different deployment), which is why v2.12.2+ shows the Apps Script build in every sync message and v2.12.3 warns when it is not the expected one. 3 + 4 rows were skipped for an unknown event / unreadable time (now listed by `testRun` and in `stats.skippedRows`). **Unverified until the coach re-tests** (S2-S3, S6 in the v2.12 test script). No failures were seen in round 2.

---

## Added in v2.12

Scope: every dated swim from the Sheet (Apps Script 2.2.4, payload 2.4), a robust sync, matching/identity fixes, and several bugs found in a multi-round coach UAT. 644 automated checks (74 + 57 + 171 + 65 + 25 + 85 + 78 + 38 + 20 + 31), all passing; the logo line is byte-identical to v2.10/v2.11. Dashboard v2.12.7, script build 2.2.4-b5.

| # | Found by | Problem | Root cause | Fix |
|---|---|---|---|---|
| 1 | design | Only the fastest swim per event reached the dashboard; a slower later swim, or two swims before a sync, were lost | `buildPayload` collapsed to one entry per event+course | emit every dated swim; same-day swims separate (identity includes the time); undated keep fastest-only |
| 2 | UAT | Orphaned swim after a Sheet date edit | the Sheet only ever added to the dashboard | report Sheet-sourced swims the Sheet no longer lists (never auto-delete) |
| 3 | UAT | Warning flagged only 1 of several far-faster swims | the first fast swim became the baseline for the next | flagged swims never become the baseline; every swim of a day compared with the best before that day |
| 4 | UAT | A stale deployment looked like features not working | code pasted but not saved before deploying; `testRun` runs editor code | build marker in every sync message, loud warning when it is not the expected build |
| 5 | UAT | Slow sync, then a bare HTTP 404 | Google Apps Script slowness; no retry or message | retry 404/5xx/timeouts (3 x 90 s), plain-language errors |
| 6 | UAT | Sheet read took ~13 s | cost is per ROW (~1.7-2.5 ms) and the tab has ~3,100 formula rows below the data | read forward in 250-row chunks, stop after 2 blank chunks (testRun 12.9 s -> 6.5 s, sync 17-18 s -> 8-11 s). Two wrong theories on the way (timezone calls, column width) |
| 7 | UAT | Real swims silently skipped (`#REF!` from deleted Data Entry rows; times typed in the wrong column) | unreadable time cells were just dropped | list skipped rows by record number with plain-language reasons |
| 8 | UAT | **Two records shared one id: Edit showed the wrong record and Delete removed both** | the Apps Script builds `id` from the Sheet name only | `ensureUniqueIds` (repairs on load); missing test coverage added |
| 9 | UAT | A corrected DOB made a duplicate swimmer | identity = name + DOB | DOB-aware matching (design approved); same-name/different-DOB pairs warned about |
| 10 | known #10 | A stray space in the Sheet made a duplicate swimmer; Remove could delete the original | sync key = lower-case + trim only | shared `normaliseNameKey`; a sync stops (nothing changed) if two swimmers would collide |
| 11 | known #12/#13 | SE wording wrong; DOB mismatch shown without the dates | text only | wording fixed; both dates + day/month-swap hint; summary lists DOB mismatches; accent folding |
| 12 | UAT | Old "Cleared all swimmers" message lingered | Manage Data stays open under Sync / SE import | cleared when either starts |

Deliberately changed existing checks: `probe_pbs_widening.js` x3 (same-day behaviour), `test_se_matching_matrix.js` scenario T, `probe_se_import.js` SE # wording.

## Added in v2.11

Scope: the SE PB Report Import (plan Sections 2, 4, 5), plus the fixes below found during a multi-round coach UAT. 392 automated checks (74 + 57 + 171 + 65 + 25), all passing; the logo line is byte-identical to the v2.10 file (hash verified at every hand-back).

### Features
- **SE PB Report Import** (Manage Data card → wizard modal: files → review → summary); native `.xlsx` reader; row-shape parser; tiered swimmer matcher; time-conflict and probable-duplicate resolution (skip / replace date / import separately, with bulk buttons); live review counts; apply only when something would change; SE # filled in only where blank; every write through `sanitiseSwimmersData()`.
- **Auto-matched list** that surfaces name differences; collapsed lists of what will be added and updated.
- **`mergePbs()` protects SE-confirmed results** from the Google Sheet (same-date mismatch kept + counted; same-time/different-date Sheet rows not re-added) and reports both in the sync and Upload-Merge messages.
- **Google Sync:** Keep/Hide/Remove wording rewritten; **Remove asks for confirmation** with the list of swimmers and PBs that would be deleted.
- **Add/Edit Swimmer:** "＋ Add PB entry" floats in the sticky footer; a manual add scrolls to and focuses the new row.

### Bugs found and fixed (root cause → fix → how verified)

| # | Found by | Problem | Root cause | Fix |
|---|---|---|---|---|
| 1 | UAT | ~290 rows "skipped"; every boy's header "unrecognised" | Real exports use `(Open/Boy 12)`; regex required `(Boy 12)` | Optional repeatable `category/` prefix; test with the exact line; plan Section 2 corrected |
| 2 | UAT | "click for detail" showed only 30 of 290 rows | `.slice(0, 30)` cap | Show all, in a height-capped scrolling box (also for the other two long lists) |
| 3 | UAT (twice) | Em-dashes in user-visible text | My sweep only covered the `<script>` block and missed the static Manage Data card | Fixed; sweep now covers static HTML and render code; house style: hyphens in UI text |
| 4 | UAT | "can't backfill times … beaten in" unclear | Poor wording | Rewritten in plain language in both places |
| 5 | UAT | Unmatched swimmer despite same surname/DOB/gender | Tier 3 *excluded* candidates holding a different SE # | Deprioritise instead; offer with the conflict named; matrix test |
| 6 | UAT | Arty/Artyom auto-match invisible | Auto-matches showed no per-swimmer detail | Auto-matched detail box with name-difference note (test script 3.3 also corrected: an SE # match auto-matches, it is not a suggestion) |
| 7 | UAT | "What does the tick do?" | No explanation | Explanatory line (see #12 for its remaining inaccuracy) |
| 8 | UAT | Disabled Apply still looked live | No `.btn:disabled` style anywhere | Added |
| 9 | UAT | Review said 2 adds, apply did 4 | Preview computed once and always excluded duplicates; apply used separate logic | `seComputeOutcomes()` shared by preview and apply; all 27 duplicate-choice combinations tested for agreement |
| 10 | UAT | Replace counted as a new PB (summary summed to 16 for 15 results) | Replace removes one record and adds one: an update, counted as both | Replace is an *update*; every entry in exactly one bucket; sum asserted |
| 11 | UAT | Ticking pulled the view to the top (reported 3 times) | Two fixes protected only the outer modal; the real cause was each list being its own scroll box (and `<details>` collapsing), rebuilt by `innerHTML` | Save/restore every `[data-keep]` list and details state around each redraw; reproduced and verified failing before the fix |
| 12 | UAT | Re-sync brought back replaced made-up-date rows | `mergePbs` matches on event+course+date; the old-date record was gone so the Sheet row looked new | `seSuppressed` rule; tested in Keep/Remove/Hide; stable on repeat syncs |
| 13 | UAT | Sheet typo could beat an SE-confirmed time | "Faster wins" was the only signal in `mergePbs` | `seProtected` rule |
| 14 | UAT | Apply live when nothing to import | Enabled whenever a swimmer was matched | Enabled only on a real change; explanatory note |
| 15 | UAT | Add-PB button out of reach in a long list | Static position | Moved into the sticky footer |
| 16 | UAT | Sync "Remove" could silently delete swimmers (and their SE-imported PBs) after a Sheet rename | Name+DOB matching + no confirmation | Confirmation with list and possible-rename hint |
| 17 | tests | Several probe failures | Test-harness faults, not app bugs: stale file-input reference after the modal re-renders; fixture SE # collisions; stale source-text windows; wrong dates in assertions; a hand-count error of mine | Fixed in the tests; lessons recorded in architecture.md |

### Testing (v2.11)
`test_overview.js` 74, `probe_pbs_widening.js` 57 (updated: `mergePbs` returns `{pbs, seProtected, seSuppressed}`), `probe_se_import.js` 171 (wired wizard; real Arty files; all 27 duplicate combinations; Keep/Hide/Remove semantics; Remove confirmation), `test_se_import_core.js` 65 (parser/matcher/reader extracted from `index.html`; real files; zip-bomb/truncation/oversize), `test_se_matching_matrix.js` 25. **Backup & Restore verified (not assumed) to need zero changes.** `node --check` clean.

---

## Added in v2.10 (condensed)
`pbs` widened to many dated entries per event+course; per-PB `source`; `mergePbEntry()` (locked spec) + `resolvePbEntryConflict()`; live `getCurrentPbMap()`; Hot Right Now = improvements only (`computePbImprovements()`); `sanitiseSwimmersData()` validates `source`. **Real bug fixed:** `mergePbs()` keyed by event+course only, silently wiping manual PBs on merge → keyed by event+course+date. Open Issue #7 fixed. UAT: logo placeholder restored from the v2.9 file (never retype the base64); whitespace-sensitivity of name+dob matching logged (#10).

## Added in v2.9 (condensed)
SE # end to end (Apps Script column E; `mergeSwimmers` authoritative carry-through with soft conflict warning; Add/Edit field with validation); mobile fixes (date inputs, iOS zoom); UAT fixes (no forced empty PB row, sync dialog holds open for warnings, "matched" vs "updated" counts, sticky action row).

## Added in v2.8 (condensed)
Full Backup & Restore (single JSON bundle, Replace-only, excludes sync URL/token).

## Fixed in v1.0 through v2.7
Unchanged; see `session-log.md`. Milestones: v1.0 initial build; v2.1 security/bug patch; v2.2 Sheets sync; v2.2.1 regression + security fix; v2.3 GitHub QT sync + Manage Data redesign; v2.4 diagnostics + stored-XSS fixes; v2.5 Overview tab; v2.6 full code review (security/a11y/mobile); v2.7 further mobile fixes.
