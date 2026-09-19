# Coach Dashboard — Handover Document (v2.8 shipped → starting v2.9)

**File:** `index.html` · **Last shipped version:** v2.8 (Backup & Restore — code shipped and verified this session)

---

## 1. What this handover covers

**v2.8 (Backup & Restore) shipped in the session this handover follows.** Scope was held exactly to what `se-pb-import-and-history-plan.md` Section 6 and the prior handover specified — nothing from v2.9–v2.11 was started. This handover updates the previous one (written after the SE-import planning session) to reflect that v2.8 is now done, and re-points the queue at **v2.9** as the next session's starting point.

**Read `se-pb-import-and-history-plan.md` in full before writing any v2.9 code** — it still contains the confirmed SE report format, the full PB-history design, the locked `mergePbEntry()` spec, and the phased build order below. This handover is a condensed map of it, not a substitute. Also skim `known-bugs-and-fixes.md`'s "Added in v2.8" section and `session-log.md`'s v2.8 entry for exactly what shipped and how it was verified — not required reading for v2.9's own scope, but useful context for how this project runs.

---

## 2. What's queued, in order — start with v2.9

Three remaining versions, **each its own chat session**:

| Version | Scope | Depends on |
|---|---|---|
| ~~v2.8~~ | ~~Backup & Restore~~ | **Shipped.** See Section 3 below for what's now true because of it |
| **v2.9 — start here** | SE# field: Apps Script reads `"Basic Data"` column E → `se` in payload → `mergeSwimmers()` carries it (authoritative when present) → editable field in Add/Edit Swimmer | Nothing |
| v2.10 | `pbs` schema widening (multiple dated entries per event+course allowed, `source` field added) + `mergePbEntry()` implementation + derived current-PB helper threaded through `buildSwimmerRows`/Hot Right Now/Bubble List/`sanitiseSwimmersData` + Hot Right Now's definition tightened to "recent improvements" | v2.9 |
| v2.11 | SE PB import itself: SheetJS → block parser → SE#/name+DOB matching → per-record diff via `mergePbEntry()` → conflict review UI → apply | v2.9 + v2.10 |

**Why this order:** the riskiest piece (v2.10's schema change) touches real existing surface area across the app — bundling it with other changes in one sitting makes a regression hard to bisect. Separate sessions also keep each session's own doc updates (`architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`) accurate to what's actually shipped at that point, which is exactly the discipline this handover itself is an example of — v2.8's docs were fully updated before this handover was written, not deferred.

**Start the next session on v2.9.** It's independent of v2.10/v2.11's schema work, small, and mechanical.

---

## 3. What v2.8 actually changed, and why it matters for v2.9+

**Feature shipped:** a "🗄️ Full Backup & Restore" card in the Manage Data modal — download all three data sources as one JSON bundle, restore from one later (Replace-only, per dataset present in the bundle, validated through the existing sanitisers, gated behind an explicit confirmation). Fully additive; the three existing per-source cards are untouched. See `known-bugs-and-fixes.md`'s "Added in v2.8" section for the full writeup and the two scoping decisions made (partial-bundle handling, `confirm()` vs. conflict-box UI).

**Why this matters going forward, concretely:**

- **The Manage Data modal now has a fourth card.** Any future UI added to this modal (nothing is currently planned for v2.9–v2.11, but worth flagging) must go **before** `#dataModalStatusDock` in the DOM — same rule as always, now verified with the new card present too. If v2.11's conflict review UI for SE import ends up living in this modal rather than its own, re-run the same DOM-order check.
- **Backup & Restore is schema-agnostic and needs zero changes for v2.9 or v2.10.** It snapshots/restores `SWIMMERS`/`COUNTY_QT`/`REGIONAL_QT` verbatim through `sanitiseSwimmersData()`/`sanitiseQTData()` — whatever those two functions accept at any point in time is exactly what a backup bundle round-trips. v2.9 adding an `se` field to swimmer records, and v2.10 widening `pbs` to hold multiple dated entries, both flow through Backup & Restore automatically once `sanitiseSwimmersData()` itself is updated to accept the new shape — **no separate update to `downloadBackupBundle()`/`loadBackupFile()`/`applyBackupRestore()` should be needed.** If a future session finds itself editing those three functions to accommodate a schema change, that's a signal something about the "schema-agnostic by design" property has been broken and is worth stopping to reconsider.
- **The precedent for "no new sanitiser, reuse the existing one" is now established twice** (Backup & Restore's Restore path, alongside the original manual-upload/sync paths) — v2.9's SE# field and v2.10's `source`/widened-`pbs` field should extend `sanitiseSwimmersData()` itself rather than writing a parallel validation path anywhere, including inside the eventual v2.11 SE-import code.
- **The `probe_backup_restore.js` / `probe_fixes.js` pattern (a small, dedicated, non-permanent jsdom probe for a scoped change) is now used twice** (v2.7, v2.8) for changes that don't touch the Overview tab. v2.9's scope (Apps Script + `mergeSwimmers()` + a form field) is a reasonable candidate for the same pattern rather than folding into `test_overview.js`, which is Overview-tab-focused specifically.

---

## 4. Decisions already locked from the original SE-import planning session — do not re-litigate these

Unchanged since the last handover; carried forward verbatim because v2.8 didn't touch any of this.

**SE report format** (from the real sample files, not screenshots):
- Sheet has no merged cells; swimmer-header row is one cell, one line: `"Lastname, Firstname: DD/MM/YYYY  (Gender Age) SE#"` — **no category prefix**, unlike what the old plan's screenshots suggested.
- Column A ("Rank") is always `"1"` — it's genuinely the Rank column; this is a Top-Times-only export.
- Blank-row spacing is inconsistent *even within one swimmer's block* — block detection must be by row shape (header pattern vs. numeric-rank-plus-known-event), never blank-row position.
- Meet names are hard-truncated at exactly 30 characters by SE's export. **A truncated SE competition value never overwrites a fuller existing one** — only used when writing a genuinely new record.
- `P/F/T` (race stage) column — **ignored entirely**, not stored or surfaced.

**PB history:**
- `sw.pbs` **keeps its field name** — only its cardinality widens (multiple dated entries per event+course allowed, was exactly one). No rename to `results`/`history` — keeps every existing export/sync shape valid with zero migration. (This includes the v2.8 backup bundle format — see Section 3 above.)
- New per-PB-entry field: `source` (`"gala"`/`"se"`/`"manual"`). Missing `source` on existing data defaults to `"gala"` at read time — no backfill-write pass.
- **Current PB and "was this a PB at the time" are always recomputed live, never stored/cached** — avoids staleness when a historical entry is added out of chronological order later.
- Record identity for diffing/merging is **event + course + date** (not time) — two sources disagreeing on time for the same date is exactly what should raise a conflict, not create a duplicate record.
- The SE report is current-best-only and **cannot backfill history in one shot** — it only ever seeds one dated point per event/course per import. Real history builds by diffing *repeated* imports over time against what's already stored. Set this expectation with the coach before v2.11 ships.
- Gala sync's Apps Script currently collapses to fastest-per-event+course before export (`buildPayload()`) — richer gala-sourced history requires a separate future rewrite of `apps_script_v2.2.2.gs`. **Explicitly deferred**, not part of v2.9–v2.11.
- The swim-dash-style visual "Progression" tab (charts + derived-column all-results table) — **explicitly deferred**. The data model must be correct now; the UI can follow later.
- No visible changes to County/Regional tabs in this round.

**`mergePbEntry()` — fully specified, locked, do not redesign:** see `se-pb-import-and-history-plan.md` Section 4 for the complete table. Summary: identity = event+course+date; no match → auto-add (no coach review); match+same time → no-op (source tag never silently changes); match+different time → per-record conflict, coach chooses keep-existing (no change) or use-incoming (full straight replacement of time/source/competition, respecting the truncation-preference rule).

**SE# field:**
- Confirmed location: `"Basic Data"` tab, **column E**, header `"SE #"`.
- Sheet-sourced SE# is authoritative when present (same trust tier as name/dob/gender).
- A Sheet-sync SE# that *conflicts* with an already-stored SE# (e.g. backfilled earlier by SE import's name+DOB fallback) gets a soft warning, not a silent overwrite.

**Backup & Restore:** **Shipped in v2.8**, exactly to spec — see Section 3 above and `known-bugs-and-fixes.md`'s "Added in v2.8" for what was actually built. Additive to existing per-source cards; Replace-only on restore with explicit before→after confirmation; excludes sync credentials from the bundle.

---

## 5. Things to know before touching v2.9 code

Carried forward from before v2.8, still true, plus one new item from v2.8 itself:

- **`collectRecentPbs()` is the one PB-reading path without "safe by construction"** — reads `sw.pbs` directly, bypassing `buildSwimmerRows()`'s `ALL_EVENTS`-constrained lookup. Once v2.10 widens what `pbs` can hold, this function's redefinition (the plan doc's "recent improvements" change) needs the same scrutiny the v2.6 stored-XSS fix already established for it — don't assume the new shape is safe by default. Not relevant to v2.9 itself (which doesn't touch `pbs`), but worth remembering it's coming.
- **`saveQTToStorage()` returns true/false** — check the result if you add a new caller. (v2.8's `applyBackupRestore()` does this correctly — a working reference if v2.9 needs a similar pattern for a new write site.)
- **`sanitiseSwimmersData()` returns `{ clean, skipped, datesDropped }`** — destructure accordingly. This function needs updating in v2.9 (to accept/pass through the new `se` field) and again in v2.10 (to validate the widened `pbs` array and the new `source` field).
- **Every `localStorage.setItem()` goes through `lsSet()`, every read through `lsGet()`** — firm convention, followed by v2.8's new write sites too.
- **The Manage Data modal's status dock (`#dataModalStatusDock`) must remain the last child of `.modal-box`** — any new UI added to that modal goes *before* the dock in the DOM, not after. This is exactly the bug v2.7 fixed and v2.8 was careful to preserve (verified with a jsdom probe both times) — easy to reintroduce by accident if a future card or row gets appended in the wrong place.
- **v2.8's `downloadBackupBundle()`/`loadBackupFile()`/`applyBackupRestore()` should need zero changes for v2.9 or v2.10** (see Section 3) — if you find yourself editing them to accommodate the SE# field or the widened `pbs` schema, stop and reconsider; the design intent was that updating `sanitiseSwimmersData()` alone is sufficient.

---

## 6. Testing approach for what's coming

Standing convention: extract `<script>` → `node --check` → run `test_overview.js` where relevant (i.e. when a change touches the Overview tab specifically) → confirm with a real rendered sample or `getComputedStyle`/DOM-state assertion, not just markup presence. For changes that don't touch the Overview tab (v2.7's mobile fixes, v2.8's Backup & Restore), a small dedicated one-off probe (not merged into the permanent suite) has proven to be the right-sized tool — see `probe_fixes.js` and `probe_backup_restore.js` as templates.

**v2.9 specifically** is a reasonable candidate for the same dedicated-probe pattern: verify the Apps Script's `getFinalCumColIndex`-adjacent column-E read (this part needs testing directly against the `.gs` file or a mocked Sheet range, not jsdom), verify `mergeSwimmers()` carries `se` through correctly and treats it as authoritative when present (a jsdom probe against the real `index.html`, similar in shape to `probe_backup_restore.js`), and verify the Add/Edit Swimmer form's new SE# field validates as a non-empty digit string when present with no fixed length enforced.

**v2.10** needs its own dedicated regression pass (per the plan doc's Section 3.3 sign-off) before v2.11 builds on it — this is the version with the most existing-surface-area risk, and should include a full `test_overview.js` run given it touches `buildSwimmerRows`, Hot Right Now, and the Bubble List directly.

**v2.11 (SE import)** needs a parser-level test against the **real sample files** (not synthetic data, already reviewed and confirmed — see plan doc Section 2) before wiring into the UI, plus a dedicated matching/conflict-detection test using synthetic swimmers with deliberately overlapping/conflicting dated PBs — mirroring how `test_overview.js`'s existing tie-break tests use synthetic fixtures rather than hoping real sample data happens to exercise every branch.

---

## 7. Files — current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.8 | Backup & Restore shipped this session |
| `apps_script_v2.2.2.gs` | v2.2.2 | Unchanged this session — will need updating in v2.9 (SE# column read) |
| `probe_backup_restore.js` | new, v2.8 | One-off jsdom probe for the v2.8 feature, not part of the shipped dashboard |
| `test_overview.js` | v2.5 | jsdom dev-time test harness for the Overview tab — unchanged since v2.5; not touched by v2.7 or v2.8, both of which used dedicated one-off probes instead |
| `se-pb-import-and-history-plan.md` | v2 | Unchanged this session — still the source of truth for v2.9–v2.11 |
| `coach_dashboard_handover.md` | this file, rewritten this session | Updated to reflect v2.8 shipped and re-point the queue at v2.9 |
| `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md` | all v2.8, updated this session | Reflect v2.8 as shipped; nothing in them describes v2.9–v2.11 as done, since nothing is |

Real sample SE report files (`ALL_COMPETITIVE_SHORT_COURSE`, `ALL_COMPETITIVE_LONG_COURSE`) were reviewed during the original planning conversation and their findings are captured in the plan doc — keep them (or equivalents) on hand for v2.11's parser testing. Not needed for v2.9.
