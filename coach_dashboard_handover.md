# Coach Dashboard — Handover Document (v2.12 shipped → starting v2.13)

**Files:** `index.html` (dashboard, title **v2.12.7**) and `apps_script_v2.2.4.gs` (**build 2.2.4-b5**). Both built, tested (**644 automated checks**) and signed off by the coach after a long UAT. **Nothing from v2.13 has been started.**

---

## 1. Read these first (in order)
1. This document.
2. `known-bugs-and-fixes.md` — open issues #14, #19, #20, #23, #27 (and the "needs a decision" items) are the v2.13 backlog.
3. `architecture.md` (the v2.12 section) and `data-schema.md` (Sections 5, 10, 13).
4. `se-pb-import-and-history-plan.md` (Section 7 now records v2.12 as done) and `se-matching-scenarios.md` (Section 4b).
5. `session-log.md` v2.12 entry — it records what went wrong along the way; the lessons are in Section 7 below.

---

## 2. Roadmap

| Version | Scope | Status |
|---|---|---|
| **v2.12 "Data foundations"** | every dated result from the Sheet (heats and finals), same-day swim model, warnings, script robustness; matcher improvements; shared name key + collision stop; unique ids; DOB-aware matching; small fixes | **SHIPPED** |
| **v2.13 "Tabs"** | Dedicated **Swimmers** tab (known-bugs #9) + a **Data** tab (import / export / backup / SE review); the backlog items below that fit navigation and settings | **Confirmed in principle; scope still to agree (Section 5)** |
| **v2.14 "Progression"** | visual progression / all-results view (swim-dash model), built on the full history from v2.12 | Confirmed as the sequence; detailed scope nearer the time |

**Schema rename before v2.14 (proposal):** `pbs` no longer means "personal bests" (it holds every dated swim). Renaming it is a schema-version change across the swimmer JSON, backup bundle, Apps Script payload and UI wording (known-bugs #19). Do it as its own session just before Progression, not mixed into another feature.

---

## 3. What v2.12 shipped (one screen)
- **Apps Script 2.2.4:** emits **every** non-DQ Results row (not only the fastest). Same-day swims (heat + final) stay separate, told apart by time; exact duplicate rows collapse; undated rows keep fastest-only; ordered by date then record number (Results column A). Payload `version 2.4` adds `build`, `warnings` (recent swims >15% faster than the swimmer's previous best; flagged swims never become the baseline) and `stats` (skipped rows with record numbers and reasons, timing split). Reads the Results tab in 250-row chunks and stops after 2 blank chunks (the Sheet has ~3,100 formula rows below the data; every read costs roughly 1.7–2.5 ms **per row**).
- **Dashboard:** `mergePbs` keys by event+course+date+**time**; SE-confirmed protection is directional (a slower same-day Sheet swim is a plausible heat and is added; a faster one is protected and flagged); `mergePbEntry` matches the same-day entry with the same time before declaring a conflict; Hot Right Now = one improvement per event per day; swims the Sheet no longer lists are **reported, never deleted**; sync retries 404/5xx/timeouts (3 attempts, 90 s each) with plain-language errors; the sync message shows the script build and warns loudly if it is not `EXPECTED_SCRIPT_BUILD`; skipped Results rows, unusually fast swims and orphaned swims are listed by record number.
- **Matching:** sync uses the same `normaliseNameKey` as the SE import and **stops (nothing changed)** if two swimmers would collapse to one key; swimmer **ids are forced unique** (and repaired on load); a swimmer whose DOB differs only slightly (one field, or a day/month swap) is matched via same id + name and the Sheet's DOB wins; the SE import shows both DOBs with a day/month-swap hint and lists DOB mismatches in its summary; accents are folded for first-name similarity only; wording fixed (#12).
- **Small:** stale Manage Data status cleared when starting a Sync/SE import; test paths configurable (`INDEX_FILE`, `FIXTURE_DIR`, `SE_SAMPLE_DIR`).

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

## 5. v2.13 scope — to agree with the coach before coding (with my recommendations)
Core (confirmed in principle): Swimmers tab (#9), Data tab.
Candidates that fit the same UI work — ask which to include:
1. **Filter footer counts (#20):** count and group swimmers excluded by the Gender/Age/Squad/name filters (reuse the existing details list). Small; fits the tab work. *Recommend: include.*
2. **Sync message redesign (#23):** a one-line summary plus one collapsible section per note type (a table for skipped rows by record number), built from DOM nodes. The probes read `#syncStatus.textContent` and assert no element children for hostile text; adjust those to check for no injected markup. *Recommend: include, probably living in the Data tab.*
3. **System Settings / maintenance mode (#27):** extend the existing ⚙️ Settings modal (URL/token): diagnostics on/off, tab visibility, theme/colours, logo (validated image stored as a data URI), default sync mode, default Hot Right Now days and Bubble margin, retry/timeout, storage meter, backup reminder. Decide: per-browser only, or in the backup bundle (never the token). *Recommend: its own sub-step after Swimmers/Data, so the navigation changes land first.*
4. **Merge-duplicates tool:** nothing merges two records that are already duplicates (clean-up today = delete the Sheet's record, correct the other's DOB). *Recommend: include if the Swimmers tab gets a per-swimmer actions menu.*
5. **Acknowledge a warning** (#14 suppressed-rows note, unusually fast swims, "no longer in Sheet") so a handled item stops repeating. Needs a small persisted key. *Ask.*
6. **Apps Script speed:** if the ~6 s `testRun` / 8–11 s sync becomes a problem, the Sheets Advanced Service reads values + colours in one request; it needs a one-off setting in the Apps Script project. *Only if the coach asks.*

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

## 7. Setting up a fresh workspace and testing
```
git clone https://github.com/asushinski9-netizen/coach-dash.git work && cd work
npm install jsdom
# test_se_import_core.js needs the two Bob/Bib sample .xlsx (not in the repo); rebuild them from se_sample_rows.json:
python3 - <<'EOF'
import json, openpyxl, os
os.makedirs('/tmp/xl', exist_ok=True); d = json.load(open('se_sample_rows.json'))
for k, n in (('sc', 'SHORT'), ('lc', 'LONG')):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Top Times(0)'
    [ws.append(r) for r in d[k]]
    wb.save(f'/tmp/xl/ALL_COMPETITIVE_{n}_COURSE_-_Copy.xlsx')
EOF
export SE_SAMPLE_DIR=/tmp/xl/      # also INDEX_FILE, FIXTURE_DIR
for f in test_overview.js probe_pbs_widening.js probe_se_import.js test_se_import_core.js test_se_matching_matrix.js \
         probe_same_day.js test_apps_script_v224.js probe_stage2.js probe_ids.js probe_dobmatch.js; do node $f | grep -E "FAIL|ALL CHECKS"; done
```
**Baseline to reproduce before any edit:** 74 + 57 + 171 + 65 + 25 + 85 + 78 + 38 + 20 + 31 = **644 checks, 0 failures**. (`test_se_import_core.js` runs against rebuilt workbooks, not the original SE exports; the coach's real Arty `.xlsx` match `arty_rows.json` cell for cell.)

**Logo integrity (mandatory):** `grep "^const LOGO_DATA_URI" index.html | sha256sum` must print `501b76d31b1c5e3d89aaabb39dd4e4ae752d5fb0915a27e49a4ccf72b35b142f`. Record it before editing and re-check before every hand-back. Never retype the base64; edit in place with exact-match replacements (the patch scripts assert each old string occurs exactly once).

**Process rules that paid off:** re-run baselines first; write the test first and **show it failing for the right reason**; reproduce each reported bug before fixing (the duplicate-id bug was only understood by reproducing it); test every PB read/write path with a multi-entry-per-event+course swimmer; check disabled/empty/"nothing to do" states; ask the coach before changing tested sync/merge behaviour; **measure before optimising** (two performance theories this session were wrong until the coach's `testRun` numbers showed otherwise); run long shell steps with `timeout` and write patch scripts to files; give every build a visible marker (title + script build).

---

## 8. Files — current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.12.7 | signed off |
| `apps_script_v2.2.4.gs` | 2.2.4 build b5 | signed off; **replaces** `apps_script_v2.2.3.gs` (keep the old file for reference; `test_se_field.js` still targets it) |
| `test_overview.js` 74, `probe_pbs_widening.js` 57 (3 checks changed on purpose in v2.12), `probe_se_import.js` 171, `test_se_import_core.js` 65, `test_se_matching_matrix.js` 25 (scenario T is now "high") | | existing suites |
| `probe_same_day.js` 85, `test_apps_script_v224.js` 78, `probe_stage2.js` 38, `probe_ids.js` 20, `probe_dobmatch.js` 31 | new in v2.12 | |
| `se_sample_rows.json`, `arty_rows.json`, `swimmers_pb__3__-_Copy.json` | fixtures | the coach confirmed they are anonymised |
| `user_test_script_v2.12.md` | v2.12 | coach script; all rounds passed |
| docs: `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md`, `se-pb-import-and-history-plan.md`, `se-matching-scenarios.md` | v2.12 | updated |
| `probe_se_field.js`, `test_se_field.js`, `probe_backup_restore.js` | earlier | not re-run (stale or untouched code paths) |

---

## 9. Guidance already given to the coach (keep repeating)
- Download a fresh backup right after any real SE import you intend to keep, and before anything destructive: Restore replaces everything.
- Be careful with the sync's **Remove**: it deletes whole swimmers not found in the Sheet by name + date of birth, with all their PBs (a confirmation lists them). Keep is the safe choice.
- The SE import is forward-accumulating; it cannot bring in a time a swimmer has since beaten.
- **Clear, never delete, rows in Data Entry** (deleting leaves `#REF!` in Results).
- Correcting a mistyped time or date in the Sheet **cannot remove the old value from the dashboard**; the sync lists it ("no longer in the Google Sheet") and the coach deletes it in ✏️ Edit Swimmer.
- A far-faster swim is warned about for up to 60 days; a genuine big improvement will keep being mentioned until it ages out.
- After any Apps Script change: Save, then deploy as a **New version** of the existing deployment, then check the build shown at the end of the sync message.

## 10. Suggested opening prompt for the next session
"Continuing the Coach Dashboard. Read `coach_dashboard_handover.md`, then `known-bugs-and-fixes.md` (open items) and `architecture.md`'s v2.12 section. v2.12 is shipped and signed off. Scope this session: v2.13 'Tabs'. Rebuild the workspace, reproduce the 644-check baseline, record the logo hash, then raise the Section 5 questions with your recommendations before writing any code, and write tests first."
