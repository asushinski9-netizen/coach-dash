# Coach Dashboard — Known Bugs & Fixes (v2.10)

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script Web App as `${syncUrl}?token=${token}`. Risks the token landing in browser history and server/proxy access logs. Correct fix is a `doPost` handler reading the token from the JSON request body — requires a coordinated change to `apps_script_v2.2.3.gs`. **Still not fixed.** Unchanged in v2.10 (a schema/merge-logic session, not touching sync transport).

### 2. Single shared sync token, not per-coach
One `ACCESS_TOKEN` in Apps Script Script Properties, shared by every coach. Documented accurately in the Settings modal. **Deliberately not addressed** — real per-coach auth needs an Apps Script schema change that's a genuine feature, not a fix. Unchanged in v2.10.

### 3. Apps Script quota
Apps Script has a daily execution quota (~20,000 calls on personal accounts). No rate limiting implemented. Low risk for single-coach use. Unchanged.

### 4. GitHub QT sync has no *offline* handling
Unchanged since v2.6/v2.8 — see prior versions of this file for detail. Not relevant to v2.10, which touches no network code.

### 5. Manual-upload/sync validation still isn't exhaustive
Still not validated: swimmer `id`, `squad` value normalisation, QT `age` bracket strings against the actual valid set. Unchanged in v2.10 — see prior versions of this file. `pbs`/`source` validation is now as exhaustive as `se`'s (Section "Added in v2.10" below).

### 6. (New context, no code change yet) SE PB report import — matching/conflict/history design is planned, not built
Unchanged from v2.9's writeup. Queued as ~~v2.9 (SE# field)~~ **shipped** → ~~v2.10 (`pbs` schema widening + `mergePbEntry()`)~~ **shipped, this session** → **v2.11 (the import itself) — next.** See `se-pb-import-and-history-plan.md`.

### 7. ~~`test_overview.js` — stale test fixture~~ — FIXED in v2.10
Previously tracked here as a known pre-existing failure (root-caused in the v2.9 session's post-ship follow-up: `sw_bubble_hidden_test`'s hardcoded dob+time had "aged into" already-qualified status as real time passed, so the Bubble List's hidden-swimmer-inclusion assertion no longer had a near-miss swimmer to find). **Fixed this session** by rebuilding that fixture the same dynamic way (`getCountyAgeBracket()` + `lookupQT()` against the live QT data, not a hardcoded dob/time pair) that Section 12's tie-break test already used — the exact fix this issue always called for. Re-run and confirmed: `test_overview.js` now passes with **zero** known failures on both the unmodified v2.9 baseline and the v2.10 build. See "Testing" under "Added in v2.10" below.

### 8. (Operational gotcha, not a code bug) Redeploying Apps Script as a NEW deployment silently breaks sync
Unchanged from v2.9's writeup — see prior versions of this file. Not touched in v2.10 (no Apps Script changes this session).

### 9. (Feature request, explicitly deferred to v2.12) A dedicated "Swimmers" tab for basic profile data
Unchanged from v2.9's writeup. Still queued for v2.12, independent of the SE-import roadmap (v2.10/v2.11).

### 10. (Pre-existing sharp edge, noted during v2.10 UAT, not fixed) Swimmer matching by `name|dob` is whitespace/case-sensitive beyond trim+lowercase
`mergeSwimmers()`'s `localKey` is `name.toLowerCase().trim() + '|' + dob`. An internal difference (e.g. a double space in a name) between the Google Sheet and a locally-entered swimmer means no match: the Sheet's copy is added as a new swimmer and the local one kept as "local-only", i.e. a silent duplicate. Reproduced in a scratch test; predates v2.10 and unrelated to it. Worth a decision (normalise internal whitespace in the key?) in a future session; the v2.11 SE import's name+DOB fallback matching should use the same normalisation, so it's worth settling before then.

---

## Added in v2.10

Scope, held exactly to the session brief: `pbs` schema widening (multiple dated entries per event+course), the new per-PB `source` field, `mergePbEntry()` (the fully-specced, locked function from `se-pb-import-and-history-plan.md` Section 4), a derived-live current-PB helper threaded through `buildSwimmerRows`/Hot Right Now/Bubble List, Hot Right Now's redefinition to "recent improvements," and `sanitiseSwimmersData()`'s extended validation. Plus one real production bug, found and fixed in the same session (see below) — reported directly by the coach, not originally scoped, but small in surface area and squarely inside this session's own `pbs`-handling code.

### Real production bug found and fixed: manual PBs silently wiped out by an upload/sync merge

**Reported directly by the coach**, and reproduced before any fix was attempted: a swimmer with two manually-entered PBs for the same event+course (e.g. two dated 50 Free entries, added via separate rows in Add/Edit Swimmer — nothing in `saveSwimmer()` stopped this, and both saved correctly) would lose **both** manual entries the moment a swimmers file with a faster time for that same event was uploaded as a Merge, or the coach re-synced from Google Sheets. Only the newly-uploaded/synced entry survived.

**Root cause:** `mergePbs()` — the function behind both gala sync and manual-upload Merge — built its working map keyed purely by `` `${event}|${course}` ``, with no date in the key at all:
```js
localPbs.forEach(pb => { pbMap[`${pb.event}|${pb.course}`] = { ...pb }; });
```
Before the uploaded/synced file was even considered, this line alone collapsed the coach's two manual entries down to whichever one happened to be processed last while just building the *local* side of the map — the first was silently discarded. The incoming file's entry for that same event+course then overwrote whatever survived. Net effect: both manual PBs gone, only the uploaded one left.

This became a real, everyday-reproducible bug specifically because of what v2.10 is: multiple entries per event+course only became a legitimate, common thing to have on file this session (a coach could always technically enter two rows for the same event in Add/Edit Swimmer before v2.10 too, but the app's entire mental model — one PB per event+course — meant nothing further downstream expected or tested that shape surviving a merge). Fixing this was therefore treated as squarely v2.10's own responsibility, not a tangential side fix.

**Fix:** `mergePbs()` re-keys to `` `${event}|${course}|${date || ''}` `` — the same event+course+date identity `mergePbEntry()` uses for its own record matching (not a coincidence; it's the correct notion of "same recorded swim" either way). Every distinct dated entry — manual, gala, or eventually SE-imported — now survives a merge independently. The existing "keep whichever time is faster" comparison `mergePbs()` has always done is preserved, but now only fires when two sources genuinely describe the *same* dated swim (a real duplicate-report situation worth reconciling), not merely two different swims that happen to share an event+course. This is a scoped, minimal correctness fix to `mergePbs()`'s *existing* quiet-merge behaviour — it deliberately does **not** give `mergePbs()` `mergePbEntry()`'s richer per-record conflict-review UI; that stays exclusive to `mergePbEntry()` (and v2.11's SE import), per the locked spec.

Verified with a dedicated reproduction in `probe_pbs_widening.js`: a swimmer with two manual dated PBs for the same event+course, merged (via both the raw `mergePbs()` function and end-to-end through `mergeSwimmers()`, simulating a real upload-merge) against an incoming file with a faster PB for that event on a third, different date — all three entries now survive, none lost or duplicated. A same-date collision (two sources genuinely reporting the same dated swim) still correctly keeps whichever time is faster, confirming the fix didn't lose that pre-existing behaviour.

### Feature: `pbs` schema widening — multiple dated entries per event+course

- `sw.pbs` **keeps its field name** — only what it's allowed to hold changes: many entries per event+course are now valid, where before there was effectively one (nothing enforced this before either, but nothing downstream handled more than one surviving a merge — see the bug above). No migration needed; every existing export/sync/backup shape stays valid, since "one entry" is just a degenerate case of "many."
- New optional per-PB-entry field: **`source`** (`"gala"` / `"se"` / `"manual"`). A PB entry with no `source` — every entry stored before this version — is treated as `"gala"` at **read time** via the new `getPbSource(pb)` helper (`pb.source || 'gala'`), not backfilled with a one-time write pass.
- **`sanitiseSwimmersData()`** extended (not duplicated) to validate `source` against the three allowed values when present — an invalid value drops just that field, keeping the PB entry, following the exact "drop the field, keep the record" pattern `se` already established in v2.9. Returns a new `pbSourceDropped` count, threaded through `describeSanitiseIssues()` and all three of its existing callers (manual upload, sync, restore) with no other changes needed at those call sites.
- Multiple entries for the same event+course were **never actually deduplicated** by `sanitiseSwimmersData()`'s filter/map even before this session — so no change was needed there to *allow* the widened cardinality; the only real gap was everything downstream (Hot Right Now, `mergePbs()`) that implicitly assumed at most one entry per event+course, which is what this session's other changes (below) and the bug fix above actually address.

### Feature: `mergePbEntry()` — implemented exactly per the locked spec

Implemented as a standalone, fully-tested function in `index.html`, per `se-pb-import-and-history-plan.md` Section 4. **Not wired into any UI flow yet** — it has no caller in v2.10; v2.11's SE import is its intended first caller, per the phased build order the plan doc locked. Implementing and testing it now, ahead of that caller, was itself the explicit v2.10 scope.

- **Identity: `event + course + date`** — deliberately excludes `time`, so two sources disagreeing on the time for the same real swim raises a conflict rather than silently fragmenting into a duplicate record.
- **`outcome: 'add'`** — no existing entry matches the identity. Auto-appended, tagged with the incoming record's `source` (or `'manual'` if none given). No coach review.
- **`outcome: 'noop'`** — an existing entry matches identity *and* time. Nothing changes at all — **`source` is sticky and never silently changes on a match**, even if the incoming record's `source` differs from what's already stored (verified directly: a `'gala'`-sourced entry matched by an incoming `'se'`-sourced record with the same time stays `'gala'`).
- **`outcome: 'conflict'`** — identity matches but `time` differs. Surfaced via `existingEntry`/`incomingEntry`/`index` for the caller's UI — never auto-resolved either direction. `resolvePbEntryConflict(existingPbs, index, incoming, resolution)` applies the coach's choice: `'keep'` leaves everything untouched; `'incoming'` does a full straight replacement of time, source, and competition.
- **Competition/venue handling** (not part of identity, per spec): `mergeCompetitionField()` + `isTruncatedFragmentOf()` implement the rule that an incoming competition string only overwrites an existing one if the existing value is empty, or the incoming value is *not* a truncated (exactly-30-character, matching SE's confirmed export truncation) fragment of a fuller existing value. Verified directly: a genuinely different competition name does overwrite; a truncated fragment of the same fuller name does not, even when the conflict is resolved as "use incoming" for the time/source.

### Feature: derived-live "current PB" helper, threaded through every consumer

- New `getCurrentPbMap(pbs)` — pulls the "fastest entry per event+course, scanned live across the *entire* pbs array" logic (already exactly what `buildSwimmerRows()` did inline before this session) out into its own named, documented, reusable function. `buildSwimmerRows()` now calls it directly; County/Regional and the Bubble List (which both go through `buildSwimmerRows()`) automatically share the same definition rather than three independent copies of the same loop.
- **Never stored or cached anywhere** — always recomputed from the full array on every call, per the plan doc's Section 3.3 rationale: a stored "is this the current PB" flag would go stale the instant an earlier-dated entry is added out of chronological order later (a coach backfilling an old result, or a future SE import seeding one historical point). Verified directly: a synthetic swimmer with three dated entries for the same event+course, deliberately **not** in chronological order, still returns the genuinely fastest one as the current PB.

### Feature: Hot Right Now redefined as "recent improvements," not every recorded swim

- New `computePbImprovements(pbs)`: groups a swimmer's **dated** pbs by event+course, sorts each group chronologically, and walks forward tracking the best-so-far time — an entry only counts as an "improvement" if it beat everything strictly before it in that group. Undated entries are excluded entirely (unchanged convention: an undated PB can't be placed in a chronological feed).
- **Required, not optional, once `pbs` can hold non-PB history** — without this, a swimmer with three dated swims for the same event+course (one an improvement, one not, one an improvement again) would previously have shown all three in Hot Right Now; now only the two genuine improvements appear. Verified directly with exactly that three-swim scenario, both against the pure helper and end-to-end through `renderHotList()`'s rendered output.
- `collectRecentPbs()` now calls `computePbImprovements()` instead of iterating `sw.pbs` directly for every dated entry — the actual code-level redefinition.

### Security review: `collectRecentPbs()`'s "not safe by construction" property, re-examined for the widened schema

Per the v2.6 stored-XSS history (see below), `collectRecentPbs()` is the one PB-reading path that bypasses `buildSwimmerRows()`'s `ALL_EVENTS`/`'S'|'L'`-constrained lookup, reading `sw.pbs` directly. Widening what `pbs` can hold — more entries, plus a new `source` field — was explicitly treated as a reason to re-verify this property, not assume it carried over for free just because `sanitiseSwimmersData()` was extended.

**Confirmed safe, and confirmed why:** `sanitiseSwimmersData()`'s per-entry validation (`pb.event` against `ALL_EVENTS`, `pb.course` against `'S'`/`'L'`, `pb.date` shape) already ran (and still runs) independently over *every* entry in the array, regardless of how many entries exist for a given event+course — the filter/map never depended on "exactly one entry" as an assumption. Widening cardinality therefore doesn't change what validation each individual entry receives. Verified directly with a synthetic swimmer holding three entries for the same event+course, one with a malicious `course` value (`"><img src=x onerror=1>"`) planted in the *middle* one — the sanitiser drops exactly that one entry and keeps the other two valid ones, exactly as it would for a single-entry swimmer. `source` itself is validated as a plain enum-membership check against three known strings, so it carries no injection surface of its own — never rendered raw anywhere in this session's changes.

### Verified: Backup & Restore needs zero changes for the widened schema (confirmed, not assumed)

`downloadBackupBundle()`/`loadBackupFile()`/`applyBackupRestore()` themselves were **not touched** this session. Per the v2.8 design bet (documented in `architecture.md`), the bundle's `swimmers` piece is pre-sanitised through the exact same `sanitiseSwimmersData()` call every other swimmer-data path uses — so extending that one function was expected to be sufficient. This was **verified directly** in `probe_pbs_widening.js` rather than left as an assumption: a bundle-shaped payload with widened `pbs` (multiple entries per event+course) and every valid `source` value round-trips through `sanitiseSwimmersData()` with zero data loss and zero special-casing required.

### Testing

- **`test_overview.js`** — Section 7's stale fixture rebuilt dynamically (see Open Issue #7 above); re-run against both the unmodified v2.9 baseline and the finished v2.10 build. **Zero failures on either** — confirming the fixture rewrite alone (no app-code change) was the complete fix for Issue #7, and that none of this session's actual `pbs`/merge changes introduced any new Overview-tab regression.
- **`probe_pbs_widening.js`** (new, v2.10, not part of the shipped dashboard) — 45 checks covering: `sanitiseSwimmersData()`'s widened-array/`source` validation; `getPbSource()`'s default; `getCurrentPbMap()`'s live-derivation correctness against out-of-order entries; `computePbImprovements()`'s improvement-vs-non-improvement discrimination (pure function and end-to-end through `renderHotList()`); every `mergePbEntry()` outcome (`add`/`noop`/`conflict`) including the sticky-source-on-no-op property and the competition-truncation rule; the `mergePbs()` bug-fix reproduction (pure function and end-to-end through `mergeSwimmers()`); `saveSwimmer()`'s source-tagging (new swimmer → `manual`; editing an unrelated field preserves an untouched PB's original source; genuinely editing a PB's time re-tags it `manual`); the widened-schema XSS-safety re-check; and the Backup & Restore compatibility check. All 45 passed.
- `node --check` clean on the extracted script throughout.

### Feature (small, incidental): `saveSwimmer()` now tags each PB entry with a `source`

Not explicitly called out in the original session brief, but a necessary consequence of adding the `source` field at all — one of its three valid values (`manual`) needs an actual writer, and Add/Edit Swimmer is the obvious one. New helper `resolvePbSourceOnSave(existingPbs, entry)`: when editing an existing swimmer, an untouched PB entry (matched by event+course+date+time against what was already on file) keeps its original `source` unchanged — editing an unrelated field like Squad and re-saving must never silently reclassify existing gala-synced history as "manual" just because the form always rebuilds the whole `pbs` array on Save. A genuinely new PB row, or an existing one with an edited time/date, is tagged `'manual'`, since a human just typed it into the form. Verified directly for all three cases (new swimmer, untouched edit, genuinely-changed edit).

### Post-UAT findings, same session (coach ran `user_test_script_v2.10.md`)

The coach ran the full manual test script. Parts 0-3 all passed, including the headline scenario (Part 1: manually-entered PBs surviving an upload-merge) and Hot Right Now's improvements-only behaviour (Part 2). Two further items came out of the round:

1. **Logo rendered broken in the delivered `index.html` - real, fixed (with a caveat).** Root cause: to speed up local test iteration the embedded base64 logo was stubbed out, and the end-of-session "restore" was a hand-retyped ~2,700-character blob that came out corrupted (confirmed: the decoded stream had no JPEG end-of-image marker and PIL refused to open it). This is exactly the reconstruction risk the v2.7 process note already warned about ("never ship a locally-reconstructed copy without confirming the real logo made it back in") - and was not caught by any test, since none assert on the logo's bytes. **Interim fix:** replaced with a small, verified-valid placeholder badge PNG, and a code comment beside `LOGO_DATA_URI` flags it as a placeholder. **Still outstanding:** the real club logo line from the last known-good production file (v2.9) must be spliced back in verbatim - a straight copy, never retyped. Tracked in `coach_dashboard_handover.md`.
2. **"Squad/SE # not overridden by a Google Sheet sync" - investigated, NOT a bug.** Reproduced directly against the real `mergeSwimmers()`: with a non-blank Sheet value, the Sheet correctly overrides a manual Squad/SE # edit, and the SE # conflict warning fires. (Blank Sheet cells deliberately never erase local values - the documented v2.9 design.) The coach's observation turned out to be from syncing the wrong data set, not from the code. During the investigation a related pre-existing sharp edge was noticed and is worth recording, not fixing here: `mergeSwimmers()` matches swimmers by `name|dob`, so a swimmer whose name differs even by whitespace between the Sheet and the local record is not matched - the Sheet's version is added as a second swimmer and the local one is kept. Not reported by the coach, no change made; logged as Open Issue #10 below.

---

## Added in v2.9

Scope, held exactly to what the session brief specified: the SE# field end-to-end, per `se-pb-import-and-history-plan.md` Section 5. Plus two unrelated mobile bugs, reported and fixed in the same session (see below) — not originally in scope, but small, self-contained, and requested directly.

### Feature: SE # field, end-to-end

- **`apps_script_v2.2.3.gs`** reads a new "Basic Data" column E, header `"SE #"`, via a newly-extracted `parseBasicDataRow(row, ss)` — pulled out specifically so this logic is unit-testable outside Apps Script (see `test_se_field.js`). Includes an optional `se` string on each swimmer in the sync payload when present; omitted entirely (not an empty string) when blank, matching how `squad` is already handled. Payload `version` bumped `"2.2"` → `"2.3"`.
- **`mergeSwimmers()`** carries `se` through from an authoritative sync at the same trust tier as `name`/`dob`/`gender`. **Soft-warning conflict handling** (not a silent overwrite, not a block): if a swimmer already has an `se` and the incoming sync value is *different*, the Sheet's value still wins (it's still authoritative), but the change is counted (`stats.seConflicts`) and named (`stats.seConflictNames`), surfaced in `startSync()`'s success message so a coach can double-check the Sheet if it looks wrong — this is exactly the kind of thing that signals a typo or an earlier SE-import fallback-match error, per the plan doc's reasoning.
- **`sanitiseSwimmersData()`** validates `se` as `/^\d+$/` when present — invalid values are **dropped, not fatal**: just the `se` field is removed, the swimmer record itself is kept (same treatment as an invalid PB `date`). Returns a new `seDropped` count, surfaced via `describeSanitiseIssues()` on every path that already calls it (manual upload, sync, restore) with zero changes needed to those call sites beyond destructuring the new field.
- **Add/Edit Swimmer** gained an optional SE # input, its own row directly below Gender/Squad (not squeezed into an existing grid) — validated client-side the same way (`/^\d+$/`, blank allowed), with a clear inline error rather than a silent no-op on an invalid value.

### Two mobile bugs found and fixed in the same session (not originally in scope)

1. **Date of Birth / Date Set fields overflowing the Add/Edit Swimmer modal.** Root cause: `.form-grid-2` (Name+DOB) and `.pb-top-grid` (Event/Course/Time/Date Set) are 2-column CSS Grids, and a native `<input type="date">`'s intrinsic minimum content width is wider than a 50% column can offer on a narrow phone. **Fix, round 1:** both grids collapse to a single column under the existing mobile breakpoint.
2. **Every text field zooming the page in on focus, staying zoomed after tapping out.** iOS Safari zooms the whole viewport in when a focused control's computed `font-size` is under 16px. **Fix:** a single mobile-only rule raises `.form-input`, `.name-search`, `.qt-inline-input`, `.margin-input-group input`, and bare `select` to `font-size: 16px`.

**Round 1's Date of Birth/Date Set fix turned out to be insufficient** — see "Fixes made after the coach's manual UAT pass" below for the round-2 fix.

### Fixes made after the coach's manual UAT pass (same session, before sign-off)

1. **Date of Birth / Date Set still overflowing on mobile, round 2** — `input[type="date"].form-input` gets explicit `width/height/box-sizing`, plus the internal WebKit/Blink date sub-elements' own padding is reset.
2. **Add/Edit Swimmer forcing an empty PB row by default** — `showAddSwimmerModal()` and `editSwimmer()` no longer auto-add a blank row.
3. **Sync modal's auto-close firing before a warning could be read** — `startSync()` now computes `hasNotableWarning` and only arms the 3-second auto-close timer when it's false.
4. **`mergeSwimmers()`'s "updated" count including swimmers nothing happened to, and the conflict dialog appearing off-screen** — `swimmerFieldsChanged()` comparison added; `showDataConflict()` now scrolls into view.

### A second UAT round, same session

Five more points raised, three fixed, one confirmed-as-designed, one queued for v2.12 (Open Issue #9). See prior version of this file for full detail — unchanged by v2.10.

### Testing

- `test_se_field.js` — 15/15 checks, unchanged this round.
- `probe_se_field.js` — 45 checks, all passed.
- Full `test_overview.js` run: **2 pre-existing failures** noted at the time (Open Issue #7) — now fixed in v2.10, see above.

---

## Added in v2.8

Not a bug-fix session — a single, planned feature: Full Backup & Restore. See prior version of this file, or `session-log.md`'s v2.8 entry, for the complete writeup — unchanged by v2.9 or v2.10.

---

## Fixed in v1.0 through v2.7

Unchanged from prior versions of this file. See `session-log.md` for the full turn-by-turn narrative of each session. Summary of major milestones: v1.0 (initial build), v2.1 (security/bug patch), v2.2 (Google Sheets sync), v2.2.1 (regression + security fix), v2.3 (GitHub QT sync, Manage Data redesign), v2.4 (diagnostics, stored-XSS fixes), v2.5 (Overview tab built), v2.6 (full codebase review — security/a11y hardening, mobile fixes, the original Hot Right Now stored-XSS finding), v2.7 (two more mobile fixes, corrected root causes for two v2.6 "fixes" that weren't quite right).
