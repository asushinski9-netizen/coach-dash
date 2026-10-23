# Coach Dashboard — Architecture (v2.12)

## Overview

Single HTML file (`index.html`, ~5,510 lines, ~316 KB). No build step, no runtime dependencies: vanilla JS in the page itself. All state lives in `localStorage`. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable and clearable from one "📤 Manage Data" modal, plus a "🗄️ Full Backup & Restore" card (v2.8) and, new in v2.11, a "🏁 SE PB Report Import" card that opens its own wizard modal.

The Overview tab is the default tab. County/Regional/editor tabs render lazily on first switch.

**v2.11 in one paragraph:** the official Swim England PB report import. A coach loads one or both Top Times `.xlsx` exports; a dependency-free reader and a row-shape parser turn them into swimmers with dated results; a tiered matcher links each to a dashboard swimmer (auto / suggested / skipped); `seComputeOutcomes()` — one function shared by the live review preview and the apply step — classifies every result against `mergePbEntry()`; the coach resolves time conflicts and probable duplicates; apply writes only PBs (and a blank SE #) through the existing sanitiser. Alongside it: `mergePbs()` now protects SE-confirmed results from the Google Sheet (two rules), the Google Sync "Remove" option asks for confirmation, and several UX fixes found in a five-round coach UAT. Nothing in the swimmer schema changed; `source: "se"` (reserved in v2.10) is now written for the first time.

**v2.12 in one paragraph:** the Google Sheet feed now carries **every dated swim** and the dashboard treats a heat and a final on one day as two swims. Apps Script 2.2.4 (payload 2.4) emits all non-DQ Results rows, reads the tab in chunks, and adds `build`, `warnings` and `stats`. On the dashboard `mergePbs`, `mergePbEntry` and `computePbImprovements` were reworked for same-day swims; sync gained retry/timeout handling, a script-build check, skipped-row / unusually-fast / orphaned-swim reports, a shared name key with a collision stop, guaranteed-unique swimmer ids, and DOB-aware matching. The SE import's matcher shows both dates of birth on a mismatch. `source: "se"` handling is unchanged. The swimmer schema is unchanged apart from the rule that ids are unique (the `pbs` field now holds every swim; renaming it is planned, known-bugs #19).

---

## File Layout

```
<head>
  <style>   CSS variables, layout, components, mobile overrides.
            v2.11 adds: .btn:disabled, .se-import-list / -choice / -step-title / -summary-counts /
            -detail-list. Reuses .pb-event-row (list items) and .as-action-row (sticky footer).
</head>
<body>
  .header / .tabs / .container / modals / FAB
  Manage Data modal: ... Full Backup card, NEW SE PB Report Import card, then #dataModalStatusDock
                     (still the LAST child of the modal — the v2.7 rule)
  NEW #seImportModal   static shell (#seImportBody); content is rendered by JS
  Sync modal: label/options/help text for Keep/Hide/Remove rewritten in v2.11
  Add/Edit Swimmer modal: "＋ Add PB entry" now lives INSIDE the sticky .as-action-row footer
<script>
  1–17.  CONFIGURATION … LOCALSTORAGE GUARD — unchanged
  18.    ADD SWIMMER   addPBRow(focusNewRow = true) scrolls/focuses a manually added row (guarded:
                       typeof scrollIntoView); editSwimmer() passes false for bulk population
  19–25. EDIT/DELETE, QT EDITOR, FAB, KEYBOARD (Escape also calls hideSeImportModal), LOGO, INIT
  26.    GOOGLE SHEETS SYNC: startSync (Remove confirmation added), swimmerSyncKey /
         findSwimmersRemovedBySync / buildRemoveWarning (new), mergeSwimmers, mergePbs (changed),
         mergePbEntry + helpers (v2.10, unchanged), resolvePbSourceOnSave
  27.    SE PB REPORT IMPORT — parser + matcher + reader  (NEW, pure logic, no DOM/localStorage)
  28.    SE PB REPORT IMPORT — UI orchestration           (NEW)
         setSyncStatus is still the last function in the file
```
Section 27 is delimited by the comment banners `// SE PB REPORT IMPORT — parser + matcher (v2.11)` and `// SE PB REPORT IMPORT — UI orchestration (v2.11)`; the Node tests extract between those markers, so **do not rename or remove them without updating the tests.**

---

## v2.11 — SE PB Report Import

### Pipeline

```
.xlsx file(s) ─ readXlsxRows(bytes, XLSX_BROWSER_DEPS) ─▶ 2-D array of cell strings
              ─ parseSeSheetRows(rows) ─▶ { swimmers[{identity, entries[]}], errors, warnings, course, fatal }
              ─ combineSeParsedFiles([sc, lc]) ─▶ one swimmer per SE # (or name+dob)
              ─ matchAllSeSwimmers(swimmers, SWIMMERS) ─▶ per swimmer { status, swimmer?, confidence?, reason }
              ─ (review) seFindProbableDuplicateAdds once; seComputeOutcomes(m) on EVERY render
              ─ (apply) seApplyImport walks seComputeOutcomes → mergePbEntry / resolvePbEntryConflict
              ─ sanitiseSwimmersData() ─▶ lsSet('coach_SWIMMERS') ─▶ re-render everything
```

### Reader — `readXlsxRows(bytes, deps)`
Native `.xlsx` reading with injected platform primitives (`deps.inflate`, `deps.parseXml`), so Node can test the identical code with zlib/jsdom while the browser uses `XLSX_BROWSER_DEPS` (`DecompressionStream('deflate-raw')`, `DOMParser`). Walks the zip central directory, reads `workbook.xml` → first sheet → shared strings → cell grid. `XLSX_LIMITS`: 5 MB file, 20 MB per entry, 200 entries, 20,000 rows, 30 columns. The inflate step counts **actual** output bytes (a forged header size cannot hide a bomb). Returns `{ sheetName, rows }`; the sheet name is informational only.

### Parser — `parseSeSheetRows(rows)`
Validates the header row (`Rank | Event | Best Time | P/F/T | Date | Meet Name`), then classifies each row **by shape**: blank (ignored); swimmer header (col A text, B–F empty, matches `SE_SWIMMER_HEADER_RE`); event row (col A digits + a known event). An unparseable header-shaped row *clears the current swimmer*, so the event rows under it are reported as orphans instead of being credited to the previous child. Strict per-cell parsers: `parseSeDate` (calendar-valid), `parseSeTime` (`SE_TIME_RE`, seconds < 60, > 0), course from the time suffix. `SE_SWIMMER_HEADER_RE` accepts any number of `category/` prefixes before `Boy|Girl` (`(Open/Boy 12)`). Duplicate event rows keep the fastest and warn; a file mixing S and L is fatal. Nothing here builds HTML; meet names are kept as inert text and escaped at render.

### Matching — `matchSeSwimmer` / `matchAllSeSwimmers`
Tiered (SE # → name + DOB → surname + DOB + gender); only the first two tiers auto-apply. Full scenario table: **`se-matching-scenarios.md`** (generated by `test_se_matching_matrix.js`). `normaliseNameKey()` = NFKC + lower-case + collapse whitespace. Helpers `rosterNameParts` / `forenamesSimilar`. After matching, a dashboard swimmer claimed by two SE swimmers downgrades both to ambiguous.

### The shared outcome function — `seComputeOutcomes(m)`
Given one matched swimmer `m` (with `m.duplicates` precomputed by `seFindProbableDuplicateAdds`), returns the per-entry outcomes `add | noop | conflict | dup-skip` using the **current** duplicate choices (`seGetDupChoice`: `skip` default / `replace` / `separate`). For `replace` it removes the one matched existing entry from a working copy first and records `replacedExisting`. **Called fresh by `seRenderReviewStep()` on every render and again by `seApplyImport()`** — this is the single source of truth that stops preview and apply from disagreeing (an earlier version precomputed the preview once and undercounted). Conflict *resolution* (keep/incoming) is deliberately not decided here; it needs the coach's choice and happens only at apply.

Accounting rule: every SE entry lands in exactly one bucket — `added` (new PB, incl. "import separately"), `datesCorrected` (a replace: an *update*, net zero PBs, never also counted as added), `unchanged`, `duplicatesSkipped`, `conflictsKept`, `conflictsUpdated`. Tests assert they sum to the number of results in the file.

### Wizard state and rendering
`_seImport = { step: 'files'|'review'|'summary', files, matches, decisions, rowErrors, result, parseError }`, rebuilt by `showSeImportModal()`, nulled by `hideSeImportModal()`. Per-match UI state lives on the match object (`_accepted`, `_dupChoice`). Rendering is whole-step `innerHTML` (`seRenderFilesStep` / `seRenderReviewStep` / `seRenderSummaryStep`) via `renderSeImportStep()`.

**State preservation across redraws (important).** A full `innerHTML` rebuild resets every scrollable list to its first row and collapses every `<details>`. `renderSeImportStep()` therefore saves, before each rebuild, the scroll position of the modal, of each `[data-keep]` list (`confirm`, `conflicts`, `dups`) and the open state + inner scroll of each `[data-keep]` `<details>` (`rowerr`, `auto`, `skipped`, `adds`, `updates`, `sumskipped`), blurs the control being destroyed, and restores everything immediately **and** on the next animation frame. Keys, not positions, because sections appear/disappear mid-review. **Any new scrollable list or `<details>` added to the wizard must get a `data-keep` key.** Two earlier fixes that only protected the outer modal's scroll did not work — the jump was the inner lists.

**Review screen contents:** counts badges; rows-skipped detail (all rows, scrollable); auto-matched box (flags a differing SE name); suggested matches (tick boxes; text explains what ticking does); time conflicts (per-record radios + Keep all / Use SE report for all); probable duplicates (per-record radios + Skip all / Replace all / Import all separately); skipped swimmers (DOB shown via `fmtDate`); the note under the list. **The Apply button is live only when applying would change something** (`addCount + updateCount + conflicts set to "Use SE report" + SE #s to fill in > 0`); otherwise the note explains ("Nothing to import. 15 result(s) already match what's on file…"). Disabled `.btn` buttons are styled via `.btn:disabled`.

### Apply — `seApplyImport()`
Applies only auto-matched swimmers and confirm-tier matches the coach ticked. Per swimmer: walks `seComputeOutcomes(m)`; for `replace` removes the one matched entry (by reference) then adds; writes via `mergePbEntry`/`resolvePbEntryConflict` with `source: 'se'`; passes the resulting `pbs` through `sanitiseSwimmersData()`; fills in `se` only if the swimmer has none. Never writes name, dob, gender, squad, hidden. Never creates or removes a swimmer. Saves with `lsSet`, re-renders County/Regional/Overview, shows the summary.

---

## v2.11 — Changes to existing sync/merge code

### `mergePbs(localPbs, sheetPbs)` → `{ pbs, seProtected, seSuppressed }`
(Return shape changed from a bare array; its only caller is `mergeSwimmers()`, and `probe_pbs_widening.js` was updated.) Keyed by `event|course|date` (v2.10). New in v2.11, limited to local entries with `source === 'se'`:
1. **`seProtected`** — a Sheet/uploaded row on the same event+course+date with a different time never overwrites the SE entry (previously "faster wins", so a mistyped fast Sheet time beat a correct SE time).
2. **`seSuppressed`** — a Sheet row with nothing on file under its own date but the same event+course+*time* as an SE entry is not re-added (otherwise a "Replace date" correction was undone by the next sync).
`mergeSwimmers()` aggregates both into `stats.sePbsProtected/…Names` and `stats.sePbsSuppressed/…Names`; `startSync()` and `applySwimmersUpload()` report them (the sync one holds the dialog open with a "Got it" button).

### Sync "Remove" confirmation
`swimmerSyncKey(sw)` (lower-case + trimmed name + `|` + dob) is now the one definition of "same swimmer" for sync, used by `mergeSwimmers()` and by `findSwimmersRemovedBySync(sheetSwimmers)`, a dry run of what Remove would delete (flags `possibleRename` when the Sheet has the same dob+gender under another name). `startSync()` calls `confirm(buildRemoveWarning(...))` before merging when the mode is Remove and anyone would be removed; Cancel returns before any change ("Sync cancelled - nothing was changed"). The dropdown now has plain-English labels and help text (Keep/Hide/Remove apply only to whole swimmers missing from the Sheet; Remove also deletes their PBs).

### Add/Edit Swimmer
"＋ Add PB entry" is inside the sticky footer next to Cancel/Save so it is always reachable; `addPBRow(focusNewRow)` scrolls/focuses the new row for a manual click only.

---

## v2.12 — Every dated swim, and a more robust sync

### Apps Script 2.2.4 (`apps_script_v2.2.4.gs`, build `SCRIPT_BUILD`)
Pure, Node-testable functions (the test fakes SpreadsheetApp for `buildPayload`): `parseResultRow(row, bg, ss, sheetRow)` → `{skip, detail}` or a swim; `addResultEntry(swimmer, e)` (key = event|course|date|time for a dated swim; undated = event|course, fastest only); `computeWarnings(map, today)`; `buildOutput`. `buildPayload` reads Results **forward in 250-row chunks** and stops after 2 blank chunks (`CHUNK_ROWS`, `MAX_BLANK_CHUNKS`; a gap of more than 500 consecutive blank rows would hide the rows below it), then reads the background of the name column only (DQ yellow). Measured on the coach's Sheet: every read costs ~1.7–2.5 ms **per row** (a narrower column block did not help), which is why the old "scan then read" cost ~13 s.
- **Order:** by date, then record number (column A) or Sheet row; **warnings** use the same order. The record number is never saved on a swimmer.
- **Warnings:** a recent swim (60 days) more than 15% faster than the *established* best (swims not themselves flagged; swims older than the window always update the best); each swim of a day is compared with the best from before that day. Capped at 50.
- **Payload 2.4:** `{version, build, generated, count, swimmers, warnings, stats}`; each swim is still `{event, course, time, date}`. `stats`: row counts, `skippedRows` (≤20: Sheet row, record no., reason, name, plain-English detail incl. "a time (…) is in the 150 column"), `skippedTotal`, `ms`, `msRead`, `msValues`, `msBg`, `msParse`, `rows`, `rowsRead`, `lastCol`.

### Same-day swims in the dashboard
- `mergePbs(local, sheet, opts)`: dated swim identity = event+course+date+**time** (`syncTimeToSec().toFixed(2)`, so "83.90" = "1:23.90"); an identical swim already on file wins (source sticky); undated entries keep the old fastest-wins rule. SE-confirmed (`source:'se'`) entries: a Sheet swim with the same time under another date is suppressed (v2.11 rule 2); on a date where SE has a time, a **faster** Sheet swim is protected and counted, a **slower** one is added (plausibly the heat). With `opts.fullHistory` it also returns `stale`: Sheet-sourced (`gala`/no source) dated entries the Sheet no longer lists, with a `hint` when the Sheet has the same swim under another date/time. Nothing is ever deleted.
- `mergePbEntry`: candidates = all same event+course+date entries; any with the same time → `noop`; else `conflict` against the **fastest** candidate. One candidate = original behaviour.
- `computePbImprovements`: per event+course, only each **day's fastest** swim can be an improvement.

### Sync robustness (`startSync`)
`fetchWithRetry(..., extra)` with `retryStatuses [404]`, per-attempt `timeoutMs` (AbortController), back-off; 3 attempts; `describeSyncError()` turns 404 / 5xx / 401-403 / timeout / network failure into plain-language advice; the GitHub QT sync passes no `extra`. After the merge the message is assembled from: counts + `(<script build>, history check on|off)`, then notes in this order: **build mismatch** (`EXPECTED_SCRIPT_BUILD`), QT/sanitise/SE notes, **skipped Results rows** (`sanitiseSkippedRows`), **unusually fast swims** (`sanitiseSyncWarnings`), **orphaned swims**, **DOB changed**, **same-name different-DOB**. Any note holds the dialog open (`hasNotableWarning`). All payload-supplied text is validated, capped, and written with `textContent`.

### Matching and identity
- `swimmerSyncKey = normaliseNameKey(name)|dob` (shared with the SE import). `findKeyCollisions` / `describeCollisions`: `startSync` stops **before any Remove prompt** and changes nothing if two dashboard swimmers or two Sheet rows share a key; `mergeSwimmers` also refuses (`{blocked:true}`) so upload-merge is protected too.
- `ensureUniqueIds(list)`: first non-local record keeps an id, others get `<id>_2`…; missing ids get `sw_auto_N`. Runs on load (and saves), after every merge, upload-replace and restore. (Cause of the old bug: the Apps Script builds `id` from the Sheet name only, so an unmatched Sheet swimmer duplicated the kept one's id; Edit/Delete look up by id.)
- `pairDobCorrections(local, sheet)` + `dobsLookCorrected(a,b)`: an unmatched Sheet swimmer is paired with an unmatched dashboard swimmer if same id, same normalised name, DOB differs by exactly one field or is a day/month swap, and the pairing is unambiguous both ways; authoritative sync only. The Sheet's DOB wins; `findSwimmersRemovedBySync` excludes paired swimmers. Unpaired same-name/different-DOB pairs are reported as `lookalikes`.
- SE matcher: `seIdentityDiff` / `seDobSwapped` / `seDisplayDate` (inside the pure block) put both values in the reason and set `match.dobMismatch`; `seApplyImport` records `summary.dobMismatches`; `forenamesSimilar` folds accents (NFD) for similarity only.

## Overview Tab

Unchanged since v2.10 (Squad Composition, Hot Right Now = recent *improvements* via `computePbImprovements()`, The Bubble List via `buildSwimmerRows()` → `getCurrentPbMap()`). SE-imported PBs flow through these unchanged because "current PB" and "improvement" are always computed live from the full `pbs` array.

---

## Security Notes

- **The SE file is untrusted input.** Reader limits and bomb guard (above); strict per-cell validation; unrecognised rows are reported, never guessed; every string from the file (names, meet names, reasons) is escaped with `escHtml`/`escAttr` at render (tested with markup in names and meet names, including in the review step). No code path evaluates file content.
- **All PB writes still pass through `sanitiseSwimmersData()`** (upload, sync, restore, and now SE import).
- No third-party scripts were added (SheetJS rejected: known CVEs; patched build unreachable).
- Unchanged: stored-XSS defences from v2.6, write-side `lsSet` checks, Apps Script token handling and its known limits (open issues #1/#2).
- **Privacy:** the repository that serves `county_qt.json`/`regional_qt.json` is public. Test fixtures derived from real exports (`arty_rows.json`, `swimmers_pb__3__-_Copy.json`, the real sample `.xlsx`) contain a child's name, date of birth and SE #. Keep them out of the public repo; see known-bugs #16.

---

## Data Flow

```
localStorage ─▶ SWIMMERS ─▶ renderOverview / renderTab (via getCurrentPbMap, computePbImprovements)

Writers of SWIMMERS (all validated + write-checked):
  startSync → [key-collision stop] → [Remove confirm] → mergeSwimmers → pairDobCorrections + mergePbs (se protect/suppress, stale) → ensureUniqueIds
  applySwimmersUpload (merge) → mergeSwimmers → mergePbs
  applyBackupRestore → sanitiseSwimmersData
  saveSwimmer → resolvePbSourceOnSave
  seApplyImport → seComputeOutcomes → mergePbEntry/resolvePbEntryConflict → sanitiseSwimmersData   (v2.11)
```

---

## Testing

All dev-time, Node + jsdom; none ship with the dashboard. Run from a folder containing `index.html` and the fixtures. Paths are configurable: `INDEX_FILE`, `FIXTURE_DIR`, `SE_SAMPLE_DIR` (the folder holding the two Bob/Bib sample `.xlsx`; `GS_FILE` for the Apps Script test).

| File | Checks | Covers |
|---|---|---|
| `test_overview.js` | 74 | Overview tab |
| `probe_pbs_widening.js` | 57 | pbs widening, `mergePbEntry`, `mergePbs` (3 checks changed on purpose in v2.12: same-day behaviour) |
| `probe_se_import.js` | 171 | the wired SE wizard end to end |
| `test_se_import_core.js` | 65 | parser/matcher/reader extracted from `index.html` |
| `test_se_matching_matrix.js` | 25 | every matching scenario A–Y (T is "high" since v2.12); `--table` regenerates the doc table |
| `probe_same_day.js` | 85 | same-day merge/SE/improvements, sync wiring, retry/timeout, orphaned swims, build note, skipped rows |
| `test_apps_script_v224.js` | 78 | the Apps Script, incl. `buildPayload` against a fake Sheet (chunked reads, skipped rows, warnings) |
| `probe_stage2.js` | 38 | shared name key, collision stop, matcher DOB/wording/accents, summary |
| `probe_ids.js` | 20 | unique ids, repair on load, stale Manage Data status |
| `probe_dobmatch.js` | 31 | DOB-aware matching, notes, Keep/Hide/Remove |
| `probe_se_field.js`, `test_se_field.js`, `probe_backup_restore.js` | — | earlier sessions' probes (not re-run; `test_se_field.js` targets `apps_script_v2.2.3.gs`) |

Conventions: extract pure logic from the shipped file by text markers; the Apps Script test strips only GAS-only functions and supplies `Utilities`/`SpreadsheetApp` stubs (create `Date` objects **inside** the vm sandbox: `instanceof Date` is false across realms); jsdom has no layout/`@media`/native scroll. Process rules: see `coach_dashboard_handover.md` Section 7 (tests first and shown red; reproduce bugs first; measure before optimising; visible build markers).
