# Coach Dashboard — Handover Document (v2.10 shipped → starting v2.11)

**File:** `index.html` · **Last shipped version:** v2.10 (`pbs` schema widening + `mergePbEntry()` — code shipped and verified this session)

---

## 1. What this handover covers

**v2.10 (`pbs` schema widening + `mergePbEntry()`) shipped in the session this handover follows.** Scope held to `se-pb-import-and-history-plan.md` Sections 3–4, plus one real production bug found and fixed mid-session (see below). Nothing from v2.11 was started.

**Read `se-pb-import-and-history-plan.md` in full before writing any v2.11 code** — it still contains the confirmed SE report format (Section 2) and the SE#/name+DOB matching rules (Section 5, shipped in v2.9). This handover is a condensed map, not a substitute.

**The mid-session bug fix, worth knowing about going into v2.11:** the coach reported that manually-entered PBs for the same event+course were being silently wiped out by a routine upload-merge or Google Sheets sync. Root cause was `mergePbs()` keying its working map by `event|course` only, with no date — fixed by re-keying to `event|course|date`, the same identity `mergePbEntry()` itself uses. This is now the correct, tested behaviour `mergeSwimmers()`/`mergePbs()` exhibit — **v2.11's SE import must not reintroduce this bug** by, say, adding its own separate merge path that doesn't share this identity concept. Use `mergePbEntry()` (already implemented and tested) for the import's own per-record diffing, not a new hand-rolled comparison.

**OUTSTANDING BEFORE v2.11 STARTS - the logo:** the `index.html` delivered with v2.10 carries a small placeholder badge as `LOGO_DATA_URI` (flagged by a code comment), because the real base64 was stubbed for local testing and a hand-retyped restore came out corrupted. Splice the real `LOGO_DATA_URI` line from the last known-good v2.9 file back in **verbatim (straight copy, never retyped)** and re-check the header renders. v2.11 should not start from a file with the placeholder in it.

**Open Issue #10 (new, unfixed):** `name|dob` swimmer matching is sensitive to internal whitespace differences - see `known-bugs-and-fixes.md`. v2.11's name+DOB fallback matching should share whatever normalisation is decided.

**Issue #7 (`test_overview.js`'s stale fixture) is fixed, not just tracked** — `test_overview.js` now passes with zero known failures. If v2.11 needs its own `test_overview.js` pass, start from this clean baseline.

**Queued for v2.12, not v2.11 — don't fold this in by accident:** a dedicated "Swimmers" tab for basic profile data. See `known-bugs-and-fixes.md` Open Issue #9.

---

## 2. What's queued, in order — start with v2.11

One remaining version:

| Version | Scope | Depends on |
|---|---|---|
| ~~v2.8~~ | ~~Backup & Restore~~ | **Shipped.** |
| ~~v2.9~~ | ~~SE# field~~ | **Shipped.** |
| ~~v2.10~~ | ~~`pbs` schema widening + `mergePbEntry()`~~ | **Shipped this session.** See Section 3 below for what's now true because of it |
| **v2.11 — start here** | SE import itself: SheetJS read → block parser (row-shape based, plan doc Section 2) → SE#/name+DOB matching → per-record diff via `mergePbEntry()` (already implemented) → conflict review UI calling `resolvePbEntryConflict()` (already implemented) → apply → summary | v2.9 + v2.10 — both now satisfied |

**Start the next session on v2.11.** Both of its dependencies are done — `mergePbEntry()` and `resolvePbEntryConflict()` are implemented, tested, and ready to be called; the SE# matching fields (`se` on the swimmer, `source: 'se'` as a valid PB-entry value) already exist in the schema.

---

## 3. What v2.10 actually changed, and why it matters for v2.11

**Feature shipped:** `sw.pbs` now allows multiple dated entries per event+course (was effectively one). A new optional per-entry `source` field (`gala`/`se`/`manual`) defaults to `gala` for all pre-existing data at read time via `getPbSource()`. "Current PB" is derived live by a new, named, shared helper `getCurrentPbMap()` — never stored, never cached. Hot Right Now is redefined to mean "recent improvements" via `computePbImprovements()`, not every recorded swim. `mergePbEntry()` — the fully-specced, locked merge function — is implemented and tested, with no caller yet. Plus the `mergePbs()` bug fix described above.

**Why this matters going forward, concretely:**

- **v2.11's core dependency is now fully satisfied, not just schema-ready.** Previous handovers described v2.10 as "the riskiest piece" because it touches real existing surface area (`buildSwimmerRows`, Hot Right Now, `sanitiseSwimmersData`) — that work is done, tested (45 dedicated probe checks + a clean `test_overview.js` run), and the function v2.11 actually needs to call (`mergePbEntry()`) already exists with its full locked behaviour, including the competition-truncation rule and the sticky-source-on-no-op property.
- **v2.11 should call `mergePbEntry()`/`resolvePbEntryConflict()` directly — do not reimplement any part of their logic.** The identity (`event+course+date`), the three outcomes (`add`/`noop`/`conflict`), and the competition-merge rule are all already correct and already tested. v2.11's own work is the *parsing* (SheetJS, block detection, SE#/name+DOB matching) and the *UI* (a conflict-review screen, a summary), not the merge semantics themselves.
- **The "extend the existing sanitiser, don't write a parallel one" precedent held a third time.** Adding `source` required exactly one change inside `sanitiseSwimmersData()` (plus threading a new `pbSourceDropped` count through `describeSanitiseIssues()` and its three existing callers) — Backup & Restore, sync, and manual upload all picked it up automatically, verified directly rather than assumed. **Any PB-writing code v2.11 adds must run through this same sanitiser** — see the note already in `data-schema.md` Section 1.1 and `architecture.md`'s security notes.
- **A real bug was caught specifically because this session widened the schema for real, not just on paper.** `mergePbs()`'s pre-v2.10 behaviour (keying by event+course only) had always been slightly wrong in principle, but only became an everyday-reproducible problem once multiple entries per event+course became a normal, expected thing to have on file. Worth remembering for v2.11: **any new code path that reads or writes `sw.pbs` should be checked against a multi-entry-per-event+course scenario explicitly**, not just a single-entry one, precisely because the single-entry case can look correct while silently mishandling the general case.
- **The `probe_fixes.js`/`probe_backup_restore.js`/`probe_se_field.js`/`probe_pbs_widening.js` pattern is now used four times.** v2.11's scope (SheetJS parsing + matching + a new conflict-review UI) likely needs both a dedicated probe of its own **and**, if it touches anything `test_overview.js` asserts on (unlikely, since SE import is a new, separate flow, not a change to Hot Right Now/Bubble List/Composition), a full suite run to confirm no regression — check this explicitly rather than assuming either way.

---

## 4. Decisions already locked — do not re-litigate these

Unchanged since prior handovers; carried forward verbatim because v2.10 didn't touch any of this beyond implementing what it already specified.

**SE report format** (from the real sample files, not screenshots) — unchanged, see `se-pb-import-and-history-plan.md` Section 2: no merged cells; swimmer-header row is one cell, one line (`"Lastname, Firstname: DD/MM/YYYY  (Gender Age) SE#"`, no category prefix); Rank column is always `"1"`; blank-row spacing is inconsistent, block detection must be by row shape; meet names hard-truncated at exactly 30 characters (**this exact truncation length is now encoded as `SE_COMPETITION_TRUNCATION_LENGTH` in `index.html`, used by `mergePbEntry()`'s competition-merge rule** — v2.11 doesn't need to re-derive or re-confirm this); `P/F/T` ignored entirely.

**PB history — now fully implemented, not just decided:**
- `sw.pbs` keeps its field name. ✅ Done (v2.10).
- New per-PB-entry field `source` (`gala`/`se`/`manual`), missing = `gala` at read time. ✅ Done (v2.10).
- Current PB and "was this a PB at the time" always recomputed live, never stored. ✅ Done (v2.10) — `getCurrentPbMap()` / `computePbImprovements()`.
- Record identity for diffing = event + course + date. ✅ Done (v2.10) — this is `mergePbEntry()`'s and the fixed `mergePbs()`'s shared identity.
- The SE report is current-best-only and cannot backfill history in one shot — real history builds by diffing repeated imports over time. **Still true, still v2.11's constraint to communicate to the coach before it ships** — nothing about this changed by v2.10 landing.
- Gala sync's Apps Script still collapses to fastest-per-event+course before export — richer gala-sourced history requires a separate future Apps Script rewrite. **Still explicitly deferred**, not part of v2.11.
- The swim-dash-style visual "Progression" tab — **still explicitly deferred.**

**`mergePbEntry()` — fully specified, locked, AND NOW IMPLEMENTED AND TESTED.** See `se-pb-import-and-history-plan.md` Section 4 for the spec (unchanged) and `architecture.md`/`known-bugs-and-fixes.md` for what's now actually built and verified. v2.11 calls it; does not reimplement it.

**SE# field:** Shipped in v2.9, unchanged by v2.10.

**Backup & Restore:** Shipped in v2.8. **v2.10 re-confirmed (not just assumed) that it needed zero changes** for the widened `pbs`/`source` schema — verified with a dedicated probe check.

---

## 5. Things to know before touching v2.11 code

- **`sanitiseSwimmersData()` now returns `{ clean, skipped, datesDropped, seDropped, pbSourceDropped }`** — destructure accordingly if you add a caller (v2.11's import almost certainly will, per the plan doc's requirement that any PB-writing path run through this sanitiser).
- **`mergePbEntry(existingPbs, incoming)` returns a NEW array** (`existingPbs` itself is never mutated) — `{ pbs, outcome, ...extra }`. For `'conflict'`, `extra` includes `existingEntry`/`incomingEntry`/`index`; pass those straight to `resolvePbEntryConflict(existingPbs, index, incoming, resolution)` once the coach has chosen `'keep'` or `'incoming'`.
- **`getPbSource(pb)`** — `pb.source || 'gala'` — is the correct way to read a PB's source anywhere; never read `pb.source` directly if you need to handle legacy (pre-v2.10) entries correctly.
- **`getCurrentPbMap(pbs)`** — the correct way to derive "what is this swimmer's current PB for event X, course Y" anywhere new code needs it. Do not write a new inline loop for this.
- **`mergePbs()` is now keyed by `event|course|date`, not `event|course`** — if v2.11 needs its own bespoke merge logic anywhere (it shouldn't; use `mergePbEntry()`), remember this is the current, correct, tested key shape, not the pre-v2.10 one.
- **Every `localStorage.setItem()` goes through `lsSet()`, every read through `lsGet()`** — firm convention, unchanged.
- **`mergeSwimmers()`'s `swimmerFieldsChanged()` comparison** (fields: `name`/`dob`/`gender`/`squad`/`se`/`pbs`) picks up the widened `pbs` shape (including `source`) automatically, since it JSON.stringify-compares the whole array — no change was needed here, and none should be needed for v2.11 either unless the comparison's field list itself needs to grow.
- **Mobile CSS conventions** — unchanged since v2.9; any new UI v2.11 adds (a conflict-review modal, most likely) should be checked against the existing `.form-grid-2`/`.pb-top-grid`/16px-font-on-mobile fixes rather than assumed to inherit them automatically if it's a genuinely new layout pattern.

---

## 6. Testing approach for what's coming

Standing convention, extended once more this session: extract `<script>` → `node --check` → run `test_overview.js` where relevant → confirm with real rendered/DOM-state assertions, not just markup presence → write a small dedicated probe for anything `test_overview.js` doesn't cover (now precedented four times: `probe_fixes.js`, `probe_backup_restore.js`, `probe_se_field.js`, `probe_pbs_widening.js`).

**v2.11 specifically** needs a parser-level test against the **real sample SE report files** (already reviewed, format confirmed — see plan doc Section 2) before wiring into the UI, plus a dedicated matching/conflict-detection test using synthetic swimmers with deliberately overlapping/conflicting dated PBs, calling the already-implemented `mergePbEntry()` — mirroring the "extract the pure function, test it directly" approach `test_se_field.js` established for Apps Script logic in v2.9, and that this session's `probe_pbs_widening.js` used for `mergePbEntry()` itself.

---

## 7. Files — current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.10 | `pbs` widening, `source` field, `mergePbEntry()`, the `mergePbs()` bug fix, Hot Right Now redefinition — all shipped this session |
| `apps_script_v2.2.3.gs` | v2.2.3 | Unchanged since v2.9 |
| `test_overview.js` | v2.10 | Section 7's stale fixture fixed this session (Open Issue #7 resolved); zero known failures |
| `probe_pbs_widening.js` | new, v2.10 | Dedicated jsdom probe for this session's work, 45/45 passed |
| `user_test_script_v2.10.md` | new, v2.10 | Coach-facing manual test checklist |
| `test_se_field.js`, `probe_se_field.js`, `probe_backup_restore.js` | v2.9/v2.8, unchanged | Prior sessions' dedicated probes |
| `se-pb-import-and-history-plan.md` | v2, unchanged this session | Still the source of truth for v2.11 |
| `coach_dashboard_handover.md` | this file, rewritten this session | Updated to reflect v2.10 shipped and re-point the queue at v2.11 |
| `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md` | all v2.10, updated this session | Reflect v2.10 as shipped; nothing in them describes v2.11 as done, since nothing is |

Real sample SE report files (`ALL_COMPETITIVE_SHORT_COURSE`, `ALL_COMPETITIVE_LONG_COURSE`) were reviewed in an earlier planning session and their findings are captured in the plan doc — keep them (or equivalents) on hand for v2.11's parser testing.
