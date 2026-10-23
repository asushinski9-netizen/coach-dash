# Coach Dashboard — SE PB Import & PB History — Plan (v3, after v2.11 shipped)

**Status: v2.8, v2.9, v2.10 and v2.11 are SHIPPED and UAT-passed.** This supersedes the September 2026 (v2) version. The design in Sections 3–6 was implemented as locked; Section 2 now records what real exports taught us (two corrections to the original assumptions); Section 7 is the roadmap for what comes next (re-ordering confirmed by the coach). If picking this up fresh: read this whole document, then `se-matching-scenarios.md`, then `coach_dashboard_handover.md`.

---

## 1. Background (unchanged)

The original ask was to pull each swimmer's *official* PB data from Swim England's public results lookup using the "SE #" column of the coach's Google Sheet. **Ruled out:** Swim England's Website Terms of Use prohibit systematic downloading/database-building, and this is personal data on named individuals (mostly minors). Not a risk-tolerance call — a hard no.

**The unblock (shipped in v2.11):** the coach exports two reports (Short Course and Long Course "Top Times") from the team's own SE App account and loads them into the dashboard. This is the coach's own authorised export, so none of the ToS concerns apply.

---

## 2. Report format — confirmed against real exports, with two corrections

Confirmed structure (real files, reviewed directly and re-checked in v2.11):
- Single sheet per file. **The sheet name is never relied on** (`"Top Times(0)"` in samples); the first sheet is read and its header row `Rank | Event | Best Time | P/F/T | Date | Meet Name` is validated.
- A swimmer-header row is a single cell, single line: `"Lastname, Firstname: DD/MM/YYYY  (Gender Age) SE#"`.
- Column A ("Rank") is always `1` (Top Times report); a defensive "keep the fastest" applies if a future export has several rows per event.
- Blank-row spacing is inconsistent, even *within* one swimmer's block. **Block detection is by row shape only**, never by blank-row position (verified by stripping every blank row and by inserting one between every row: identical results).
- Event names match `ALL_EVENTS` exactly. Time format `"36.97S"` / `"1:26.25S"` (numeric + course letter). Dates `DD/MM/YYYY` -> ISO. Each file is course-homogeneous; a file mixing `S` and `L` is rejected.
- `P/F/T` is ignored entirely (not stored, not shown).

**Correction 1 — the header's category prefix varies.** v2 of this plan said the real format had *no* category prefix (`(Boy 12)`), based on the two sample files. A coach's production export used **`(Open/Boy 12)`**, and every such header was unparseable (about 290 event rows reported as "skipped" as orphans). The parser now accepts any number of `category/` segments before `Boy`/`Girl` (`(Boy 12)`, `(Open/Boy 12)`, `(Open/National/Girl 14)`). **Lesson: treat the header as report-configuration-dependent and test against exports from more than one configuration.**

**Correction 2 — meet names are not always truncated at 30 characters.** v2 said SE hard-truncates at exactly 30. Real exports contain a 36-character name (`BHSC Christmas Cracker 2025 (Harrow)`) alongside many exactly-30-character ones. The competition-merge rule (`mergeCompetitionField()` / `isTruncatedFragmentOf()`) only fires on an *exactly 30-character prefix of a longer stored name*, so longer untruncated names are handled correctly; the plan's "never exceeds 30" claim is simply not true.

**Reading `.xlsx` in the browser (as built).** No third-party library: SheetJS's last npm release has known prototype-pollution/ReDoS CVEs and the patched build is not available from npm, and this file is untrusted input about minors. A small native reader (`readXlsxRows`) uses `DecompressionStream('deflate-raw')` and `DOMParser`, with hard limits (5 MB file, 20 MB per decompressed entry, 200 zip entries, 20,000 rows, 30 columns) and a decompression-bomb guard that counts real output bytes rather than trusting the zip header. Only `.xlsx` is supported (not legacy `.xls`).

---

## 3. PB progression history (implemented in v2.10; used by v2.11)

Unchanged design, now real: `sw.pbs` allows many dated entries per event+course; each may carry `source` (`gala`/`se`/`manual`, absent = `gala` at read time); "current PB" and "was this an improvement" are always recomputed live, never stored; record identity for diffing is **event + course + date**.

**What this means in practice (restated because it drives the roadmap):**
- A single SE "Top Times" export is current-best-only, so it can never backfill history; history accumulates by repeated imports. The import screen says so in plain language.
- **Google Sheets sync is *also* current-best-only today** — see Section 7.1. The Apps Script collapses the Results tab to the single fastest time per event+course before export. This was known (v2 Section 3.2) and deferred; UAT showed it is now the main obstacle to progression insights.
- Manual Add/Edit Swimmer can supply any historical result.

---

## 4. `mergePbEntry()` and how SE data is protected (implemented)

**4.1 `mergePbEntry()` — locked spec, unchanged and implemented in v2.10.** Identity `event + course + date` (never time). `add` (auto-appended), `noop` (identical; `source` is sticky), `conflict` (same identity, different time; per-record coach decision via `resolvePbEntryConflict()`: keep, or full replacement of time/source/competition). The SE import calls it for every entry; it does not reimplement any of it.

**4.2 UI-layer additions in v2.11 (not part of the locked spec; `mergePbEntry()`'s identity is unchanged):**
- **Probable duplicates.** An SE entry with the same event+course+*time* as an existing entry on a *different date* is flagged (typical cause: a backfilled PB entered in the Sheet with a best-guess date). Three choices per duplicate, with bulk buttons per swimmer: **Skip** (default; leave everything), **Replace existing date with SE's** (remove only that one matched entry and write the SE one: a net-zero *update*), **Import as a separate result** (keep both; a new PB).
- **One computation for preview and apply.** `seComputeOutcomes()` classifies every entry (`add` / `noop` / `conflict` / `dup-skip`, plus which existing entry a replace removes). The review screen and the apply step both use it, so the numbers shown can never drift from what applying does. Every SE entry lands in exactly one bucket: added, updated, unchanged, skipped, or conflict kept/replaced.
- **Apply is only live when it would change something** (a new PB, an updated record, a conflict set to "Use SE report", or an SE # to fill in).
- Everything written is passed back through `sanitiseSwimmersData()`.

**4.3 Protecting SE-confirmed data from the Google Sheet (`mergePbs()`, v2.11).** The Sheet is hand-entered and can contain mistakes (including implausibly fast times) and still holds any made-up dates the coach has since corrected via SE. Two rules, both limited to entries whose `source` is `'se'`:
1. **Same event+course+date:** an SE-confirmed entry is never overwritten by a Sheet/uploaded row with a different time, whichever is faster. Counted and reported ("N SE-confirmed PB(s) differed... kept as the SE report recorded them").
2. **Same event+course+time, different date, nothing on file under that date:** the Sheet row is treated as the same swim and not re-added (otherwise a "Replace date" correction was silently undone by the next sync, because the old made-up-date row had nothing left to match). Counted and reported with a note.
Ordinary Sheet-vs-manual behaviour (keep the faster, same-date) is unchanged. Known limit: two genuinely separate swims with an identical time on different dates would have the later Sheet row suppressed (cannot change a current PB).

---

## 5. Swimmer matching and SE # (shipped v2.9 / v2.11)

SE # is a swimmer field (v2.9). SE import matching is tiered (SE #; then name + date of birth; then surname + date of birth + gender, which is never auto-applied); only the first two tiers can auto-apply. **The authoritative description of every scenario is `se-matching-scenarios.md`**, generated from `test_se_matching_matrix.js`. The import never creates, deletes or hides a swimmer, never writes squad, never writes date of birth, and fills in an SE # only where the dashboard has none (after the match is applied/confirmed).

---

## 6. Backup & Restore (shipped v2.8)

Replace-only, schema-agnostic by construction (snapshots `SWIMMERS` / `COUNTY_QT`(+meta) / `REGIONAL_QT`(+meta) and re-runs each through its existing sanitiser). **Re-verified for v2.10 (`source`) and v2.11 (`source:"se"`): zero changes needed.** Because it is Replace-only, restoring an old bundle loses anything done since — including an SE import. Coach guidance: download a fresh backup after any import you intend to keep.

---

## 7. Roadmap for v2.12 onward (re-ordering CONFIRMED by the coach)

### 7.1 What UAT of v2.11 revealed

- **Google Sync only ever brings in the fastest result per event+course**, and only once. Adding a *slower* swim to the Sheet later is never picked up; adding two swims before a sync imports only the faster. This was designed for "today's PB", not history. With SE import now building a dated history, the Sheet feed needs to carry every dated result or the two sources are inconsistent and progression insights will have gaps. (Cause: `buildPayload()` in `apps_script_v2.2.3.gs` collapses with `if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec)`.)
- **Suggested-match rules deserve a deliberate revisit** (`se-matching-scenarios.md`, Section 4).
- Minor: the confirm-tick text says SE # is never changed (a blank is filled), test fixtures contain real personal data, and the sync/import name keys differ (open issues #12, #16, #10).

### 7.2 Phasing (confirmed; one focused session each)

| Version | Scope | Why this order |
|---|---|---|
| **v2.12 — "Data foundations"** | (a) **Apps Script emits every dated Results row** (new `apps_script_v2.2.4.gs`, payload `version` bump) plus the dashboard-side handling; (b) **revisit Suggested-match rules** and the confirm-tick wording; (c) small fixes: anonymise test fixtures/placeholder SE #, decide on a shared name-matching key (#10), make test fixture paths configurable | Progression needs the data model correct first (this plan's own principle). (a) is the only two-file change and carries a redeployment risk (open issue #8), so it should not share a session with UI restructuring. |
| **v2.13 — "Tabs"** | Dedicated **Swimmers** tab (open issue #9) and a **Data** tab for Import/Export/Backup/SE-import review (deferred by the coach in v2.11 UAT) | Both are navigation/layout work in the same area; design together so they do not fight over the tab bar (which already wraps on mobile). |
| **v2.14 — "Progression"** | The visual progression/history tab (swim-dash's "Progression" + "All Results" model, with derived "PB?" and "Δ Prev") | Needs the full history from v2.12 and, ideally, the tab structure from v2.13. |

**What moved:** the **Swimmers tab** was the v2.12 headline in the v2.11 handover; it moves to **v2.13**, because the data-foundation work above is now a prerequisite for the coach's progression goals and carries more risk. Nothing was dropped.

### 7.3 Design questions for v2.12(a) — STILL OPEN, to settle with the coach before building

1. **Heats/finals on one day:** identity is `event + course + date`, so a heat and a final of the same event on the same day collapse to the faster. Acceptable, or does the Results tab need a session/round column in the identity?
2. **How far back?** Importing every historic Results row may ingest old typos and made-up dates. Options: all rows; since a cut-off date; only rows for dates not already covered by an SE-confirmed entry. (Rule 4.3(2) already suppresses same-time/different-date copies of SE-confirmed swims.)
3. **Volume/quota:** payload size and Apps Script execution time with every row (a few hundred swimmers × years of results); keep the old payload shape readable so an un-redeployed script still works.
4. **Hot Right Now** is already improvements-only (`computePbImprovements()`), so non-PB swims will not flood it; confirm that is still the intended meaning.
5. **Mistakes in the Sheet** become visible history rather than hidden by "fastest only": does the coach want a way to flag/hide a bad row without deleting it from the Sheet?
6. **DQ rows** stay excluded (yellow fill), as today.

---

## 8. Explicitly deferred / out of scope

- "Supersede but retain" richer conflict resolution beyond straight replacement (needs its own design pass).
- A way to acknowledge/silence the "Sheet rows matching SE-confirmed results were not re-added" note until the Sheet is corrected (it appears on every sync while those rows remain).
- Per-coach sync auth, the `doPost`/header-token change, and the other long-standing items in `known-bugs-and-fixes.md`.
- Legacy `.xls` import.

---

## 9. Coach communication notes

- The coach approved the SE report upload, the PB-history mechanism, the SE # field, and the v2.8–v2.11 build order, and has signed off v2.11 after a multi-round UAT.
- **Expectation-setting is built into the UI** (Manage Data card and import screen): the import is a forward-accumulating feed, not a backfill, because the report format cannot show a result a swimmer has since beaten.
- Guidance already given in the test script: download a backup after any real import (Restore is Replace-only); be careful with the sync's **Remove** option (it deletes whole swimmers not found in the Sheet by name + date of birth; a confirmation now lists them first).
