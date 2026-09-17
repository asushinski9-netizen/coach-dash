# Coach Dashboard — Handover Document (v2.7 shipped → starting v2.8)

**File:** `index.html` · **Last shipped version:** v2.7 (no code changes since — this handover follows a planning-only session)

---

## 1. What this handover covers

**No code was written in the session this handover follows.** It was a planning conversation that: (a) reviewed the real sample SE PB report `.xlsx` files for the first time, clearing the hard blocker the old plan had been stuck on, and (b) worked through a request to also support PB progression history, which turned out to change the SE-import design materially rather than being a separate later feature.

**Read `se-pb-import-and-history-plan.md` (v2, rewritten this session) in full before writing any code** — it now contains the confirmed report format, the full PB-history design, the locked `mergePbEntry()` spec, and the phased build order below. This handover is a condensed map of it, not a substitute.

---

## 2. What's queued, in order — start with v2.8

Four separate versions, **each its own chat session**:

| Version | Scope | Depends on |
|---|---|---|
| **v2.8 — start here** | Backup & Restore: single-bundle download/restore, additive to the existing per-source Manage Data cards, Replace-only on restore, excludes sync credentials | Nothing |
| v2.9 | SE# field: Apps Script reads `"Basic Data"` column E → `se` in payload → `mergeSwimmers()` carries it (authoritative when present) → editable field in Add/Edit Swimmer | Nothing |
| v2.10 | `pbs` schema widening (multiple dated entries per event+course allowed, `source` field added) + `mergePbEntry()` implementation + derived current-PB helper threaded through `buildSwimmerRows`/Hot Right Now/Bubble List/`sanitiseSwimmersData` + Hot Right Now's definition tightened to "recent improvements" | v2.9 |
| v2.11 | SE PB import itself: SheetJS → block parser → SE#/name+DOB matching → per-record diff via `mergePbEntry()` → conflict review UI → apply | v2.9 + v2.10 |

**Why split this way:** the riskiest piece (v2.10's schema change) touches real existing surface area across the app — bundling it with three other changes in one sitting makes a regression hard to bisect. Separate sessions also keep each session's own doc updates (`architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`) accurate to what's actually shipped at that point.

**Start the next session on v2.8.** It's fully independent of everything else queued — small, mechanical, and deliberately front-loaded ahead of v2.9–v2.11 as a safety net before those start writing into swimmer data more aggressively than anything before them.

---

## 3. Decisions already locked — do not re-litigate these

Pulled from this session's planning conversation, all confirmed by the coach:

**SE report format** (from the real sample files, not screenshots):
- Sheet has no merged cells; swimmer-header row is one cell, one line: `"Lastname, Firstname: DD/MM/YYYY  (Gender Age) SE#"` — **no category prefix**, unlike what the old plan's screenshots suggested.
- Column A ("Rank") is always `"1"` — it's genuinely the Rank column; this is a Top-Times-only export.
- Blank-row spacing is inconsistent *even within one swimmer's block* — block detection must be by row shape (header pattern vs. numeric-rank-plus-known-event), never blank-row position.
- Meet names are hard-truncated at exactly 30 characters by SE's export. **A truncated SE competition value never overwrites a fuller existing one** — only used when writing a genuinely new record.
- `P/F/T` (race stage) column — **ignored entirely**, not stored or surfaced.

**PB history:**
- `sw.pbs` **keeps its field name** — only its cardinality widens (multiple dated entries per event+course allowed, was exactly one). No rename to `results`/`history` — keeps every existing export/sync shape valid with zero migration.
- New per-PB-entry field: `source` (`"gala"`/`"se"`/`"manual"`). Missing `source` on existing data defaults to `"gala"` at read time — no backfill-write pass.
- **Current PB and "was this a PB at the time" are always recomputed live, never stored/cached** — avoids staleness when a historical entry is added out of chronological order later.
- Record identity for diffing/merging is **event + course + date** (not time) — two sources disagreeing on time for the same date is exactly what should raise a conflict, not create a duplicate record.
- The SE report is current-best-only and **cannot backfill history in one shot** — it only ever seeds one dated point per event/course per import. Real history builds by diffing *repeated* imports over time against what's already stored. Set this expectation with the coach before v2.11 ships.
- Gala sync's Apps Script currently collapses to fastest-per-event+course before export (`buildPayload()`) — richer gala-sourced history requires a separate future rewrite of `apps_script_v2.2.2.gs`. **Explicitly deferred**, not part of v2.8–v2.11.
- The swim-dash-style visual "Progression" tab (charts + derived-column all-results table) — **explicitly deferred**. The data model must be correct now; the UI can follow later.
- No visible changes to County/Regional tabs in this round.

**`mergePbEntry()` — fully specified, locked, do not redesign:** see `se-pb-import-and-history-plan.md` Section 4 for the complete table. Summary: identity = event+course+date; no match → auto-add (no coach review); match+same time → no-op (source tag never silently changes); match+different time → per-record conflict, coach chooses keep-existing (no change) or use-incoming (full straight replacement of time/source/competition, respecting the truncation-preference rule).

**SE# field:**
- Confirmed location: `"Basic Data"` tab, **column E**, header `"SE #"`.
- Sheet-sourced SE# is authoritative when present (same trust tier as name/dob/gender).
- A Sheet-sync SE# that *conflicts* with an already-stored SE# (e.g. backfilled earlier by SE import's name+DOB fallback) gets a soft warning, not a silent overwrite.

**Backup & Restore:**
- Resequenced to build *first* (v2.8), ahead of the SE work — the old plan had it sequenced after, reasoning it needed the schema to settle first; revised because the bundle format is schema-agnostic (just snapshots/restores through existing sanitisers).
- Additive to existing per-source cards, not a replacement.
- Replace-only on restore, with explicit confirmation of what gets overwritten; excludes sync credentials from the bundle.

---

## 4. Things to know before touching code (carried forward from v2.7, still true)

- **`collectRecentPbs()` is the one PB-reading path without "safe by construction"** — reads `sw.pbs` directly, bypassing `buildSwimmerRows()`'s `ALL_EVENTS`-constrained lookup. Once v2.10 widens what `pbs` can hold, this function's redefinition (Section 2's "recent improvements" change) needs the same scrutiny the v2.6 stored-XSS fix already established for it — don't assume the new shape is safe by default.
- **`saveQTToStorage()` returns true/false** — check the result if you add a new caller.
- **`sanitiseSwimmersData()` returns `{ clean, skipped, datesDropped }`** — destructure accordingly. This function needs updating in v2.10 to validate the widened `pbs` array (multiple entries per event+course) and the new `source` field.
- **Every `localStorage.setItem()` goes through `lsSet()`, every read through `lsGet()`** — firm convention.
- **The Manage Data modal's status dock (`#dataModalStatusDock`) must remain the last child of `.modal-box`** — any new UI added to that modal (Backup & Restore's entry point, in v2.8) goes *before* the dock in the DOM, not after. This is exactly the bug v2.7 fixed; easy to reintroduce by accident.

---

## 5. Testing approach for what's coming

Standing convention: extract `<script>` → `node --check` → run `test_overview.js` where relevant → confirm with a real rendered sample or `getComputedStyle`/DOM-state assertion, not just markup presence.

**v2.10 specifically** needs its own dedicated regression pass (per Section 2 of the plan doc) before v2.11 builds on it — this is the version with the most existing-surface-area risk.

**v2.11 (SE import)** needs a parser-level test against the **real sample files now in hand** (not synthetic data) before wiring into the UI, plus a dedicated matching/conflict-detection test using synthetic swimmers with deliberately overlapping/conflicting dated PBs — mirroring how `test_overview.js`'s existing tie-break tests use synthetic fixtures rather than hoping real sample data happens to exercise every branch.

---

## 6. Files — current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.7 | Unchanged this session |
| `apps_script_v2.2.2.gs` | v2.2.2 | Unchanged this session — will need updating in v2.9 (SE# column read) |
| `se-pb-import-and-history-plan.md` | **v2, this session** | Substantially rewritten — real report format, full PB-history design, locked merge spec, phased build order |
| `coach_dashboard_handover.md` | this file | |
| All other docs (`architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md`) | v2.7 | **Not updated this session** — nothing in them changed, since no code shipped. Update these as each of v2.8–v2.11 actually lands, not before. |

Real sample SE report files (`ALL_COMPETITIVE_SHORT_COURSE`, `ALL_COMPETITIVE_LONG_COURSE`) have been reviewed and their findings are captured in the plan doc — keep them (or equivalents) on hand for v2.11's parser testing.
