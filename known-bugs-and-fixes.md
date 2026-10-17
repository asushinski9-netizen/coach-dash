# Coach Dashboard — Known Bugs & Fixes (v2.11)

*Older sections (v2.7 and earlier, and the detail of v2.8–v2.10) are condensed here; the full earlier text is in git history of this file (the v2.10 copy). Everything below the Open Issues list that is new is under "Added in v2.11".*

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script as `${syncUrl}?token=${token}` (risk: browser history / access logs). Correct fix is a `doPost` reading the token from the body — a coordinated change to the Apps Script. **Not fixed.** Natural to fold into the v2.12 Apps Script change if the coach wants it.

### 2. Single shared sync token, not per-coach
One `ACCESS_TOKEN` in Script Properties, shared by every coach. Documented accurately in Settings. Deliberately not addressed.

### 3. Apps Script quota
Daily execution quota (~20,000 calls personal accounts); no rate limiting. Low risk today. **Becomes relevant to v2.12** (a payload carrying every dated result is larger and slower).

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

### 10. (Pre-existing sharp edge, partly mitigated) Swimmer matching differs between features
- Google Sheets sync matches by `swimmerSyncKey` = lower-case + trimmed name + `|` + dob. An internal whitespace difference, a nickname, or a rename in the Sheet means no match: the Sheet's copy is added as a new swimmer and the local one is "local-only".
- The SE import uses `normaliseNameKey` (NFKC, lower-case, collapse whitespace), plus a tiered matcher.
- **Risk:** the sync's **Remove** option deletes dashboard swimmers not found in the Sheet *by that key*, including manually added ones, along with all their PBs (manual and SE-imported). **Mitigated in v2.11:** Remove now shows a confirmation listing exactly who would be deleted (same key function, tested equal to the actual removal set), with a "possible rename" hint when the Sheet has the same dob+gender under another name; help text explains Keep/Hide/Remove.
- **Decision for v2.12:** share one normalised key across sync and import? (A behaviour change to sync: two local swimmers that collapse to one key need a collision check so nobody is silently dropped.)

### 11. (NEW) Google Sync only brings in the fastest result per event+course
`buildPayload()` in `apps_script_v2.2.3.gs` keeps one entry per swimmer+event+course (`if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec)`). A slower swim added later is never imported; two swims added before a sync import only the faster. Designed for "today's PB", but now inconsistent with SE import, which builds dated history, and a blocker for progression insights. **Headline of v2.12** (plan Section 7). The dashboard side already copes with many dated entries per event+course.

### 12. (NEW, cosmetic but inaccurate) "Never changes … SE #" wording
The note above Suggested matches says ticking never changes Name, DOB, Gender or SE #. Not true for SE #: if the dashboard swimmer has none, confirming fills it in from the SE report (the review note says "fill in the SE # for N swimmer(s)" and the summary lists them). An existing SE # is never overwritten. Fix the wording in v2.12.

### 13. (NEW) Suggested-match rules to revisit
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

---

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
