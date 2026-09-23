# Coach Dashboard — Handover Document (v2.9 shipped → starting v2.10)

**File:** `index.html` · **Last shipped version:** v2.9 (SE # field, end-to-end — code shipped and verified this session)

---

## 1. What this handover covers

**v2.9 (SE # field) shipped in the session this handover follows, then refined further after the coach ran a full manual UAT pass in the same session** (see `user_test_script_v2.9.md`). Scope held to `se-pb-import-and-history-plan.md` Section 5, plus mobile fixes and UX fixes reported directly during testing — all fixed in this same session, still v2.9. Nothing from v2.10/v2.11 was started. One feature request surfaced during UAT (a dedicated "Swimmers" tab) was explicitly deferred by the coach to a new **v2.12**, not folded into this session.

**Read `se-pb-import-and-history-plan.md` in full before writing any v2.10 code** — it still contains the confirmed SE report format, the full PB-history design, the locked `mergePbEntry()` spec, and the phased build order below. This handover is a condensed map of it, not a substitute. Also skim `known-bugs-and-fixes.md`'s "Added in v2.9" and "Fixes made after the coach's manual UAT pass" sections, and `session-log.md`'s v2.9 entry, for exactly what shipped and how it was verified.

**One thing to pick up before or alongside v2.10, root-caused since this session (not a coach-facing bug — see below):** `test_overview.js`'s `sw_bubble_hidden_test` fixture (Section 7) hardcodes a swimmer's dob+time assuming a fixed age-bracket/QT relationship that doesn't hold as real time passes — the swimmer has since "aged into" already-qualified status, so it no longer exercises the Consideration/Outside path the test intends. **The actual `buildBubbleList()`/toggle feature was verified working correctly** with a properly non-qualified fixture time. Fix needed is test-only: rebuild that fixture the same dynamic way (`getCountyAgeBracket()` + `lookupQT()`, not hardcoded values) Section 12's tie-break test already does. See `known-bugs-and-fixes.md` Open Issue #7 for the full trace. Low priority, but tidy up alongside v2.10's own `test_overview.js` pass.

**Operational gotcha discovered post-v2.9, relevant to v2.10/v2.11 too:** using **Deploy → New deployment** in Apps Script (instead of editing the existing deployment's version) mints a brand-new `/exec` URL — if the dashboard's ⚙️ Settings still has the old URL saved, sync silently keeps hitting the stale deployment with no error, and a genuinely-correct code change looks like it "didn't work." Not a code bug (nothing to fix here), but worth checking explicitly after any `apps_script_*.gs` redeploy in a future session — see `known-bugs-and-fixes.md` Open Issue #8 for the full writeup.

**Queued for v2.12, not v2.10/v2.11 — don't fold this in by accident:** a dedicated "Swimmers" tab for basic profile data (name/DOB/gender/squad/SE#/PB count), independent of the County/Regional tabs' PB/QT-driven filtering. See `known-bugs-and-fixes.md` Open Issue #9.

---

## 2. What's queued, in order — start with v2.10

Two remaining versions, **each its own chat session**:

| Version | Scope | Depends on |
|---|---|---|
| ~~v2.8~~ | ~~Backup & Restore~~ | **Shipped.** |
| ~~v2.9~~ | ~~SE# field~~ | **Shipped this session.** See Section 3 below for what's now true because of it |
| **v2.10 — start here** | `pbs` schema widening (multiple dated entries per event+course allowed, `source` field added) + `mergePbEntry()` implementation + derived current-PB helper threaded through `buildSwimmerRows`/Hot Right Now/Bubble List/`sanitiseSwimmersData` + Hot Right Now's definition tightened to "recent improvements" | v2.9 (for a stable, `se`-inclusive swimmer schema to build against — now satisfied) |
| v2.11 | SE PB import itself: SheetJS → block parser → SE#/name+DOB matching → per-record diff via `mergePbEntry()` → conflict review UI → apply | v2.9 + v2.10 |

**Why this order:** v2.10 is the riskiest piece — it touches real existing surface area across the app (`buildSwimmerRows`, Hot Right Now, Bubble List, the sanitiser). Keeping it its own session, separate from v2.11's import-specific work, makes a regression easier to bisect, and matches the discipline this handover itself follows — v2.9's docs were fully updated before this handover was written, not deferred.

**Start the next session on v2.10.** It's the one genuine dependency-of-substance in the remaining roadmap — v2.11 can't be built sensibly against the old single-entry-per-event+course `pbs` shape.

---

## 3. What v2.9 actually changed, and why it matters for v2.10+

**Feature shipped:** an optional `se` (Swim England ID / "SE #") field on the swimmer record — read from a new "Basic Data" column E in the Apps Script sync payload (now `apps_script_v2.2.3.gs`), carried through `mergeSwimmers()` as authoritative when present (same trust tier as `name`/`dob`/`gender`), with a soft warning (not a block, not a silent overwrite) if a sync brings a conflicting value; validated by `sanitiseSwimmersData()` (drops just the field on an invalid value, never the whole swimmer); and editable via a new field in Add/Edit Swimmer. Also fixed, same session: two mobile CSS bugs (DOB/Date Set field overflow in the Add/Edit Swimmer modal; iOS's auto-zoom-on-focus affecting every text field). See `known-bugs-and-fixes.md`'s "Added in v2.9" section for the full writeup.

**Why this matters going forward, concretely:**

- **`v2.10`'s dependency on v2.9 is now satisfied.** The swimmer schema v2.10 builds against (widening `pbs`) now includes `se` as a stable, validated, optional field — nothing about v2.10's work needs to special-case its presence or absence.
- **The "extend the existing sanitiser, don't write a parallel one" precedent held again.** Adding `se` required exactly one change inside `sanitiseSwimmersData()` itself (plus threading a new `seDropped` count through `describeSanitiseIssues()` and its three existing callers) — Backup & Restore, sync, and manual upload all picked it up automatically with zero edits to any of those three paths. **v2.10's `source` field and widened `pbs` array should follow the exact same pattern**: extend `sanitiseSwimmersData()`'s validation, don't add a second validation path anywhere, including inside the eventual v2.11 SE-import code.
- **The soft-warning-not-silent-overwrite pattern for `mergeSwimmers()` conflicts is now precedented once** (the SE# conflict case) — worth reusing verbatim if v2.10's `mergePbEntry()` needs a similar "the merge still applies the incoming value, but tell the coach it happened" shape for any of its own edge cases, rather than inventing a new UI paradigm.
- **`apps_script_v2.2.3.gs` now has a genuinely unit-testable seam** (`parseBasicDataRow()`, `formatSE()`) that didn't exist before — pulled out specifically to make the column-mapping logic testable outside Apps Script. If v2.11's SE import needs any row/block-parsing logic of its own (it will — see the plan doc's Section 2 block-detection rules), the same "extract the pure function, test it directly in Node, leave the untestable `SpreadsheetApp`/`SheetJS` calls thin around it" approach is the template to reuse, not a new pattern to invent.
- **The `probe_fixes.js`/`probe_backup_restore.js`/`probe_se_field.js` pattern (a small, dedicated, non-permanent probe for a scoped change) is now used three times** for changes that don't need `test_overview.js`'s Overview-tab focus. v2.10's scope is large enough that it should probably **both** get its own dedicated probe **and** a full `test_overview.js` run (per the original plan doc's Section 3.3 sign-off requirement) — it's the first of the four sessions where the change genuinely touches what `test_overview.js` asserts on.
- **A jsdom-vs-`@media` limitation surfaced for the first time this session** (`probe_se_field.js`'s CSS caveat): jsdom does not evaluate `@media` conditions for `getComputedStyle()` purposes, so any future mobile-only CSS behavior needs verifying via source-text assertions against the relevant `@media` block, not computed-style assertions — noted directly in `probe_se_field.js` for reference.

---

## 4. Decisions already locked from the original SE-import planning session — do not re-litigate these

Unchanged since the last handover; carried forward verbatim because v2.9 didn't touch any of this beyond the SE# field itself (which is now done, not a decision still pending).

**SE report format** (from the real sample files, not screenshots):
- Sheet has no merged cells; swimmer-header row is one cell, one line: `"Lastname, Firstname: DD/MM/YYYY  (Gender Age) SE#"` — **no category prefix**, unlike what the old plan's screenshots suggested.
- Column A ("Rank") is always `"1"` — it's genuinely the Rank column; this is a Top-Times-only export.
- Blank-row spacing is inconsistent *even within one swimmer's block* — block detection must be by row shape (header pattern vs. numeric-rank-plus-known-event), never blank-row position.
- Meet names are hard-truncated at exactly 30 characters by SE's export. **A truncated SE competition value never overwrites a fuller existing one** — only used when writing a genuinely new record.
- `P/F/T` (race stage) column — **ignored entirely**, not stored or surfaced.

**PB history:**
- `sw.pbs` **keeps its field name** — only its cardinality widens (multiple dated entries per event+course allowed, was exactly one). No rename to `results`/`history` — keeps every existing export/sync shape valid with zero migration. (This includes the v2.8 backup bundle format.)
- New per-PB-entry field: `source` (`"gala"`/`"se"`/`"manual"`). Missing `source` on existing data defaults to `"gala"` at read time — no backfill-write pass.
- **Current PB and "was this a PB at the time" are always recomputed live, never stored/cached** — avoids staleness when a historical entry is added out of chronological order later.
- Record identity for diffing/merging is **event + course + date** (not time) — two sources disagreeing on time for the same date is exactly what should raise a conflict, not create a duplicate record.
- The SE report is current-best-only and **cannot backfill history in one shot** — it only ever seeds one dated point per event/course per import. Real history builds by diffing *repeated* imports over time against what's already stored. Set this expectation with the coach before v2.11 ships.
- Gala sync's Apps Script currently collapses to fastest-per-event+course before export (`buildPayload()`) — richer gala-sourced history requires a separate future rewrite of `apps_script_v2.2.3.gs`. **Explicitly deferred**, not part of v2.10–v2.11.
- The swim-dash-style visual "Progression" tab (charts + derived-column all-results table) — **explicitly deferred**. The data model must be correct now; the UI can follow later.
- No visible changes to County/Regional tabs in this round.

**`mergePbEntry()` — fully specified, locked, do not redesign:** see `se-pb-import-and-history-plan.md` Section 4 for the complete table. Summary: identity = event+course+date; no match → auto-add (no coach review); match+same time → no-op (source tag never silently changes); match+different time → per-record conflict, coach chooses keep-existing (no change) or use-incoming (full straight replacement of time/source/competition, respecting the truncation-preference rule).

**SE# field:** **Shipped in v2.9**, exactly to spec — see Section 3 above and `known-bugs-and-fixes.md`'s "Added in v2.9" for what was actually built.
- Confirmed location: `"Basic Data"` tab, **column E**, header `"SE #"`. Now read by `apps_script_v2.2.3.gs`.
- Sheet-sourced SE# is authoritative when present (same trust tier as name/dob/gender). Now implemented in `mergeSwimmers()`.
- A Sheet-sync SE# that *conflicts* with an already-stored SE# gets a soft warning (count + names, surfaced in `startSync()`'s status message), not a silent overwrite. Now implemented.

**Backup & Restore:** **Shipped in v2.8** — see `known-bugs-and-fixes.md`'s "Added in v2.8". Confirmed this session (Section 3 above) to have needed zero changes to accommodate `se`.

---

## 5. Things to know before touching v2.10 code

Carried forward from before v2.9, still true, plus what v2.9 itself adds:

- **`collectRecentPbs()` is the one PB-reading path without "safe by construction"** — reads `sw.pbs` directly, bypassing `buildSwimmerRows()`'s `ALL_EVENTS`-constrained lookup. Once v2.10 widens what `pbs` can hold, this function's redefinition (the plan doc's "recent improvements" change) needs the same scrutiny the v2.6 stored-XSS fix already established for it — don't assume the new shape is safe by default. **This is now v2.10's actual scope, not a future concern** — treat it as a required part of the session, not optional polish.
- **`saveQTToStorage()` returns true/false** — check the result if you add a new caller.
- **`sanitiseSwimmersData()` now returns `{ clean, skipped, datesDropped, seDropped }`** (the `seDropped` field is new in v2.9) — destructure accordingly if you add a caller. This function needs updating again in v2.10, to validate the widened `pbs` array and the new `source` field, following the exact same "extend, don't duplicate" pattern used for `se`.
- **Every `localStorage.setItem()` goes through `lsSet()`, every read through `lsGet()`** — firm convention.
- **The Manage Data modal's status dock (`#dataModalStatusDock`) must remain the last child of `.modal-box`** — v2.9 did not touch this modal at all, so no new risk was introduced, but the rule still stands for any future session that does.
- **`mergeSwimmers()` now returns more than the original four counts**: `seConflicts` (number), `seConflictNames` (array), and — added after UAT feedback in this same session — `matched` (number, a genuinely-unchanged matched swimmer, as distinct from `updated`). If v2.10's `mergePbEntry()` integration changes what `mergeSwimmers()`/`mergePbs()` return or how they're called, make sure `startSync()`'s and `applySwimmersUpload()`'s status-message assembly (which now read `result.seConflicts`/`result.seConflictNames`/`result.matched`) isn't broken by the refactor. **Also preserve the `swimmerFieldsChanged()` comparison's field list** (`name`/`dob`/`gender`/`squad`/`se`/`pbs`) when `pbs` widens in v2.10 — it needs to keep comparing whatever `pbs` actually looks like at that point, or every sync will start reporting false "updated" counts again.
- **Mobile CSS**: `.form-grid-2` and `.pb-top-grid` now collapse to a single column under `@media (max-width: 500px)`, and `.form-input`/`.name-search`/`.qt-inline-input`/`.margin-input-group input`/`select` are forced to `16px` in that same block. If v2.10 or v2.11 adds any new form fields to the Add/Edit Swimmer modal or elsewhere, they'll inherit these fixes automatically as long as they use the existing classes — no new mobile-specific work should be needed for typical form fields, but a genuinely new UI pattern (e.g. v2.11's conflict-review UI, if it's a new modal or a new kind of input) should be checked against both fixes rather than assumed to inherit them.

---

## 6. Testing approach for what's coming

Standing convention: extract `<script>` → `node --check` → run `test_overview.js` where relevant (i.e. when a change touches the Overview tab specifically, or — as v2.9 demonstrated — touches shared helpers `test_overview.js` also exercises) → confirm with a real rendered sample or `getComputedStyle`/DOM-state assertion, not just markup presence, **except for CSS gated behind an `@media` query, which jsdom cannot evaluate for `getComputedStyle()` purposes — use a source-text assertion against the relevant `@media` block instead (see `probe_se_field.js` for the pattern)**. For changes that don't need `test_overview.js`'s full Overview-tab focus, a small dedicated one-off probe has proven to be the right-sized tool three sessions running now — see `probe_fixes.js`, `probe_backup_restore.js`, and `probe_se_field.js` as templates. For Apps Script logic specifically that has no dependency on `SpreadsheetApp`/GAS globals, a plain Node test against the extracted pure function is both possible and now precedented — see `test_se_field.js` for the "strip the GAS-only functions, `vm.runInContext` the rest" approach.

**v2.10 specifically** needs its own dedicated regression pass (per the plan doc's Section 3.3 sign-off requirement) — this is the version with the most existing-surface-area risk, and should include **both** a full `test_overview.js` run **and** a dedicated probe for the new `mergePbEntry()`/schema-widening logic specifically, given the scale of what it touches (`buildSwimmerRows`, Hot Right Now, Bubble List, `sanitiseSwimmersData`). **Before starting, re-run `test_overview.js` against the current (v2.9) baseline and confirm the 2 known pre-existing failures (Open Issue #7) are still exactly those 2 and no more** — that establishes a clean starting point so any new failure introduced by v2.10's actual changes is unambiguous.

**v2.11 (SE import)** needs a parser-level test against the **real sample files** (not synthetic data, already reviewed and confirmed — see plan doc Section 2) before wiring into the UI, plus a dedicated matching/conflict-detection test using synthetic swimmers with deliberately overlapping/conflicting dated PBs — mirroring how `test_overview.js`'s existing tie-break tests use synthetic fixtures rather than hoping real sample data happens to exercise every branch.

---

## 7. Files — current state

| File | Version | Notes |
|---|---|---|
| `index.html` | v2.9 | SE # field + two mobile CSS fixes shipped this session |
| `apps_script_v2.2.3.gs` | v2.2.3 | SE # column read shipped this session; `apps_script_v2.2.2.gs` retained in repo history, superseded |
| `test_se_field.js` | new, v2.9 | Plain Node test for the new Apps Script column-mapping logic, not part of the shipped project |
| `probe_se_field.js` | new, v2.9 | One-off jsdom probe for the v2.9 feature + mobile fixes, not part of the shipped dashboard |
| `probe_backup_restore.js` | v2.8, unchanged | One-off jsdom probe for the v2.8 feature |
| `test_overview.js` | v2.5 | jsdom dev-time test harness for the Overview tab — unchanged since v2.5; re-run (not edited) in v2.9, surfacing the 2 pre-existing failures now tracked as Open Issue #7 |
| `se-pb-import-and-history-plan.md` | v2, unchanged this session | Still the source of truth for v2.10–v2.11 |
| `coach_dashboard_handover.md` | this file, rewritten this session | Updated to reflect v2.9 shipped and re-point the queue at v2.10 |
| `architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`, `project-brief.md`, `README.md` | all v2.9, updated this session | Reflect v2.9 as shipped; nothing in them describes v2.10–v2.11 as done, since nothing is |

Real sample SE report files (`ALL_COMPETITIVE_SHORT_COURSE`, `ALL_COMPETITIVE_LONG_COURSE`) were reviewed during the original planning conversation and their findings are captured in the plan doc — keep them (or equivalents) on hand for v2.11's parser testing. Not needed for v2.10.
