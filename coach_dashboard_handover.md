# Coach Dashboard — Handover Document (v2.11 shipped → starting v2.12)

**File:** `index.html` · **Last shipped version:** v2.11 (SE PB Report Import) — built, tested (392 automated checks) and signed off by the coach after a six-round UAT. **Nothing from v2.12 has been started.**

---

## 1. Read these first (in order)
1. This document.
2. `se-pb-import-and-history-plan.md` (v3) — especially Section 7 (proposed roadmap and the design questions for v2.12).
3. `se-matching-scenarios.md` — how swimmers are matched today (needed for the Suggested-matches revisit).
4. `known-bugs-and-fixes.md` — open issues #10–#18 are all new or changed this session.
5. `architecture.md` (the v2.11 sections) and `data-schema.md` (Sections 10–12).

---

## 2. Roadmap — CONFIRMED by the coach; design questions still open before v2.12 coding starts

The v2.11 handover said v2.12 would be the dedicated **Swimmers tab**. UAT changed the picture, and the coach has **confirmed this re-ordering**:

| Version | Proposed scope | Status |
|---|---|---|
| **v2.12 "Data foundations"** | (a) Apps Script emits every dated Results row; (b) revisit Suggested-match rules + confirm-tick wording; (c) small items: anonymise fixtures/placeholder SE #, shared name key decision, configurable test paths | **Confirmed** |
| **v2.13 "Tabs"** | Dedicated Swimmers tab (known-bugs #9) + a Data tab (import/export/backup/SE review) | **Confirmed (moved from v2.12)** |
| **v2.14 "Progression"** | Visual progression / all-results view (swim-dash model) | Confirmed as the sequence; detailed scope to be agreed nearer the time |

**Why the Swimmers tab moved:** the coach's progression goal needs the data model right first (the plan's own principle: the UI follows a correct model). The Google Sheet feed currently carries only the fastest result per event+course (known-bugs #11), so SE-sourced history and Sheet-sourced history are inconsistent; fixing that is a two-file change (Apps Script + dashboard) with its own deployment risk (#8), so it should not share a session with navigation/layout work. Nothing was dropped; the separate Data tab the coach deferred in v2.11 UAT is paired with the Swimmers tab in v2.13 because both touch the tab bar (which already wraps on mobile).

**Still open — settle these with the coach (with your recommendations) before writing v2.12 code (plan Section 7.3):** same-day heat/final identity; how far back to import Sheet history; payload size/quota; handling obvious Sheet typos; whether Hot Right Now keeps its improvements-only meaning; and the Suggested-match questions in `se-matching-scenarios.md` Section 4.

---

## 3. What v2.11 shipped (one screen)
- **SE PB Report Import** (Manage Data → 🏁 card → wizard modal): load an SC and/or LC Top Times `.xlsx`; native reader with hard limits; row-shape parser (handles `(Boy 12)` and `(Open/Boy 12)` headers); tiered matching (auto / suggested / skipped); time conflicts (keep / use SE) and probable duplicates (skip / **replace date** / import separately) with bulk buttons; live review counts that always equal what apply does; Apply only live when something would change; SE # filled in only where blank; everything through `sanitiseSwimmersData()`; never creates/deletes/hides a swimmer, never touches squad/name/DOB.
- **`mergePbs()` protects SE-confirmed PBs** from the Google Sheet (same-date mismatch kept + counted; same-time/different-date Sheet rows not re-added) — reported in sync and Upload-Merge messages.
- **Google Sync "Remove" confirms** first, listing swimmers/PBs and flagging possible renames; Keep/Hide/Remove wording rewritten.
- Add/Edit Swimmer: "＋ Add PB entry" floats in the sticky footer.

---

## 4. Decisions already locked — do not re-litigate
- **Never scrape SE's site**; the SE import reads the coach's own exports only.
- **No SheetJS / no third-party scripts**; keep the native reader (limits are deliberate).
- **`mergePbEntry()` spec is locked and implemented** (identity `event+course+date`; sticky `source`; per-record conflicts). v2.12 must not reimplement it; use it.
- **PB history model:** many dated entries per event+course; `source` `gala|se|manual` (absent = `gala`); current PB and "improvement" always computed live, never stored.
- **The SE import is a forward-accumulating feed, not a backfill**, and the UI says so.
- **The import never writes DOB, gender, squad, name, hidden; never creates/removes swimmers; fills a blank SE # only.** The Sheet remains authoritative for identity fields.
- **Replace date is an update, not a new PB.** Every SE entry lands in exactly one summary bucket; tests assert the sum.
- **Preview and apply share `seComputeOutcomes()`** — keep it that way.
- **Apply is live only when it would change something.**
- **UI text uses hyphens, not em-dashes** (house style the coach enforces; sweep the static HTML as well as the script).
- Backup & Restore stays Replace-only; Remove-mode sync keeps its confirmation.
- Per-coach auth, `doPost`/header token and the other old items stay deferred unless the coach asks.

---

## 5. v2.12 scope detail (re-ordering confirmed)

### (a) Apps Script: every dated result
- Today `buildPayload()` keeps one entry per swimmer+event+course (`if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec)`). Replace with: emit every non-DQ Results row as `{event, course, time, date}` (date required; skip undated), de-duplicated on event+course+date (keep the faster for that date — decide heats/finals), payload `version` bump (e.g. `"2.4"`), keep `se` etc. unchanged. New file `apps_script_v2.2.4.gs`; keep the testable-pure-function pattern (`parseBasicDataRow` precedent: extract row→entry mapping so it can be tested in Node).
- Dashboard: no schema change; `mergePbs` already keys by event+course+date and handles many entries; `computePbImprovements` keeps Hot Right Now improvements-only. **Verify with a multi-entry swimmer** (standing rule). Confirm the two SE protections still behave when the Sheet now brings *all* history (expect many more suppressed rows until the Sheet's made-up dates are corrected — consider whether the note needs an "acknowledge" option, known-bugs #14).
- Operational: redeploy so the URL stays valid (#8), mention quota (#3), tell the coach to keep a backup first. The coach will need to redeploy the script; plan a UAT step for it.
- Add Sheet-side test data covering: slower later swim, two swims before a sync, same-day duplicates, DQ rows.

### (b) Revisit Suggested matches
Use `se-matching-scenarios.md` Section 4 as the agenda (SE # outranking name; showing both DOBs on a DOB-mismatch suggestion; DOB-typo unmatched; gender inconsistency H vs M; accent/nickname similarity; hyphen/order surnames; "pick one" for two candidates; per-swimmer exclude for auto-matches). Any rule change must update `test_se_matching_matrix.js` expectations, regenerate the doc table (`node test_se_matching_matrix.js --table`) and be logged. Fix the confirm-tick wording (#12: a blank SE # *is* filled in).

### (c) Small items
Anonymise fixtures and the `e.g. 1745801` placeholder (#16); decide whether sync and import share one normalised name key (#10 — if sync changes, add a collision check so no swimmer is silently dropped); make test fixture paths configurable and put fixtures in a `fixtures/` folder (#17).

---

## 6. Things to know before touching the code
- **Markers:** the v2.11 pure logic sits between `// SE PB REPORT IMPORT — parser + matcher (v2.11)` and `// SE PB REPORT IMPORT — UI orchestration (v2.11)`; tests extract between them. Keep the markers.
- **`mergePbs()` returns `{ pbs, seProtected, seSuppressed }`** (not an array). Only `mergeSwimmers()` calls it.
- **Wizard redraws rebuild `innerHTML`.** Any new scrolling list or `<details>` in the wizard needs a `data-keep` key or the coach will see it reset on every click (this took three attempts to find). Tests must re-query `#seImportFileInput` after any `showSeImportModal()`.
- `swimmerSyncKey()` is the sync's "same swimmer" definition; `findSwimmersRemovedBySync()` must keep using it so the Remove warning equals what is deleted.
- `getPbSource(pb)` for source; `getCurrentPbMap(pbs)` for current PB — don't write new loops.
- Every `localStorage` write through `lsSet`, read through `lsGet`. All PB writes through `sanitiseSwimmersData()`.
- Mobile CSS conventions (16 px inputs, single-column grids, 40 px heights) apply to anything new; jsdom can't evaluate `@media` — use source-text assertions.
- For anything that depends on browser behaviour (scroll, focus), **say it is unverified until the coach tests it** and add a coach test step; reproduce first where possible.

---

## 7. Setting up a fresh workspace and testing
The sandbox working directory can be lost mid-session (it happened in v2.11); rebuild from the delivered files.
```
mkdir work && cd work && cp <delivered files> .          # index.html, tests, fixtures
cp county_qt.json regional_qt.json swimmers_pb.json .    # needed by test_overview.js / probe_pbs_widening.js
npm install jsdom
# test_se_import_core.js also needs python3 + openpyxl and the two real sample .xlsx at /mnt/user-data/uploads/
# (use separate cp commands, not {a,b} brace shorthand, in a plain sh shell)
for f in test_overview.js probe_pbs_widening.js probe_se_import.js test_se_import_core.js test_se_matching_matrix.js; do node $f | grep -E "FAIL|ALL CHECKS"; done
```
**Baseline to reproduce before any edit:** 74 + 57 + 171 + 65 + 25 = **392 checks, 0 failures**. `index.html` ≈ 5,181 lines / 290,777 bytes.

**Logo integrity (mandatory):** `grep "^const LOGO_DATA_URI" index.html | sha256sum` must print `501b76d31b1c5e3d49aaabb39dd4e4ae752d5fb0915a27e49a4ccf72b35b142f`. Record it before editing, re-check before every hand-back. Never stub or retype the base64; edit in place with `str_replace`/scripts.

**Process rules that paid off:** re-run baselines first; reproduce each reported bug and check the fix fails without the change; test every PB read/write path with a multi-entry-per-event+course swimmer; write the dedicated probe alongside the feature; check disabled/empty/"nothing to do" states, not just the happy path; ask the coach before changing tested sync/merge behaviour.

---

## 8. Files — current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.11 | signed off |
| `apps_script_v2.2.3.gs` | v2.2.3 | unchanged; v2.12 replaces it |
| `test_overview.js` 74, `probe_pbs_widening.js` 57, `probe_se_import.js` 171, `test_se_import_core.js` 65, `test_se_matching_matrix.js` 25 | v2.11 | the current suite |
| `se_sample_rows.json`, `arty_rows.json`, `swimmers_pb__3__-_Copy.json` | fixtures | **personal data — keep out of the public repo** |
| `user_test_script_v2.11.md` | v2.11 | coach script (UAT passed; step 3.3 corrected after sign-off to say an SE # match auto-matches) |
| `se-matching-scenarios.md` | new | scenario table + v2.12 questions |
| docs: `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md`, `se-pb-import-and-history-plan.md` | v2.11 / plan v3 | updated; older detail (v2.8–v2.10) is condensed — git history has the previous full text |
| `probe_se_field.js`, `test_se_field.js`, `probe_backup_restore.js` | earlier | not re-run in the v2.11 sweep (no touched code paths) |

---

## 9. Guidance already given to the coach (keep repeating)
- Download a fresh backup right after any real SE import you intend to keep — Restore replaces everything.
- Be careful with the sync's **Remove**: it deletes whole swimmers not found in the Sheet by name + date of birth, with all their PBs (a confirmation now lists them). Keep is the safe choice.
- The SE import is forward-accumulating; it cannot bring in a time a swimmer has since beaten.
- Rows in the Google Sheet that duplicate an SE-confirmed swim under an old made-up date will keep producing an informational note on each sync until corrected in the Sheet.

## 10. Suggested opening prompt for the next session
"Continuing the Coach Dashboard. Read `coach_dashboard_handover.md`, then the plan (Section 7) and `se-matching-scenarios.md`. The v2.12 / v2.13 / v2.14 re-ordering is confirmed (handover Section 2). Scope this session: v2.12 (a)/(b)/(c). Rebuild the workspace, reproduce the 392-check baseline, record the logo hash, then raise the Section 2 questions with your recommendations before writing any code."
