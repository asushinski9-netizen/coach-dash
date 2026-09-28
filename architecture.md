# Coach Dashboard — Architecture (v2.10)

## Overview

Single HTML file (`index.html`, ~3,700 lines). No build step, no dependencies beyond the CDN-free vanilla JS in the page itself. All state lives in `localStorage`. Three independent data sources — Swimmers (Google Sheets sync), County QT, Regional QT (GitHub sync) — each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal, plus a fourth "🗄️ Full Backup & Restore" card spanning all three at once (v2.8).

The Overview tab is the default tab on page load. County/Regional/editor tabs still render lazily on first switch to each.

**v2.10 in one paragraph:** `pbs` schema widening + `mergePbEntry()`, per `se-pb-import-and-history-plan.md` Sections 3–4 — nothing else from the roadmap. A swimmer's `pbs` array may now hold multiple dated entries per event+course (was effectively one, though nothing previously enforced that — see the real bug this exposed, below), each optionally tagged with a new `source` field (`gala`/`se`/`manual`, defaulting to `gala` at read time via `getPbSource()` for anything stored before this version). `mergePbEntry()` — the locked, fully-specced merge function from the plan doc — is implemented and tested as a standalone function with no caller yet (v2.11's SE import is its intended first caller). "Current PB" is pulled out into a named, always-live, never-cached helper (`getCurrentPbMap()`) used by `buildSwimmerRows()`. Hot Right Now is redefined to mean "recent improvements" (`computePbImprovements()`), not every recorded swim. `sanitiseSwimmersData()` extends to validate the new `source` field, following the exact pattern `se` set in v2.9. **One real production bug, reported directly by the coach, was found and fixed in the same session:** `mergePbs()` (gala sync + manual-upload merge) was silently discarding multiple manually-entered PBs for the same event+course during a merge — fixed by re-keying it to the same event+course+date identity `mergePbEntry()` uses. See `known-bugs-and-fixes.md`'s "Added in v2.10" section for the full writeup.

---

## File Layout

```
<head>
  <style>          CSS variables, layout, component styles, mobile overrides — unchanged in v2.10
</head>
<body>
  .header / .tabs / .container / Modals / FAB speed dial — all unchanged in v2.10
<script>
  1–17.  CONFIGURATION through LOCALSTORAGE GUARD — unchanged in v2.10, except:
         - sanitiseSwimmersData() extended (validates per-PB `source`; new getPbSource(),
           PB_SOURCES constant)
         - buildSwimmerRows() now calls the new getCurrentPbMap() helper instead of an inline
           loop (same logic, pulled out and documented)
         - collectRecentPbs() now calls the new computePbImprovements() helper
  18.  ADD SWIMMER          showAddSwimmerModal, addPBRow — unchanged
  19.  EDIT/DELETE SWIMMER  editSwimmer, deleteSwimmer, saveSwimmer — saveSwimmer() now tags
                            each PB entry's `source` via the new resolvePbSourceOnSave()
  20–27. (unchanged) QT EDITOR, FAB, MODAL A11Y, KEYBOARD, LOGO, INIT
  26.  GOOGLE SHEETS SYNC   mergeSwimmers (unchanged logic; swimmerFieldsChanged()'s pbs
                            comparison now naturally includes source, since it JSON.stringify-
                            compares the whole pbs array), mergePbs (RE-KEYED this session —
                            see "Fixed in v2.10" in known-bugs-and-fixes.md), plus the new
                            standalone mergePbEntry()/resolvePbEntryConflict()/
                            mergeCompetitionField()/isTruncatedFragmentOf()/getCurrentPbMap()/
                            computePbImprovements()/resolvePbSourceOnSave() functions, all
                            defined in this same section of the file, near mergePbs()
```

---

## v2.10 — `pbs` Schema Widening & `mergePbEntry()`

### The bug this session found (not originally scoped, but squarely in-session)

Reported directly by the coach: a swimmer with two manually-entered PBs for the same event+course was losing **both** the moment an uploaded/synced file brought in a faster time for that event. Root cause: `mergePbs()` — shared by gala sync and manual-upload Merge — keyed its working map purely by `event|course`, with no date. Building the *local* side of that map alone silently collapsed the coach's two manual entries down to one, before the incoming file was even considered.

**Fix:** `mergePbs()` re-keys to `event|course|date`. Every distinct dated entry now survives a merge independently; "keep the faster time" still applies, but only when two sources genuinely describe the same dated swim (same event+course+date), not merely the same event+course. See `known-bugs-and-fixes.md` for the full writeup and the dedicated reproduction test in `probe_pbs_widening.js`.

### Schema

`sw.pbs` keeps its field name; only its cardinality changes (many entries per event+course, was one). New optional per-entry field `source` (`'gala'|'se'|'manual'`), defaulting to `'gala'` at **read time** via `getPbSource(pb)` — `pb.source || 'gala'` — never backfilled with a write pass. See `data-schema.md` Section 1.1 for the full field table.

### `getCurrentPbMap(pbs)` — the live "current PB" derivation

```js
function getCurrentPbMap(pbs) {
  const pbMap = {};
  (pbs || []).forEach(pb => {
    const key = pb.event + '|' + pb.course;
    const sec = timeToSec(pb.time);
    if (!pbMap[key] || sec < pbMap[key].sec) pbMap[key] = { ...pb, sec };
  });
  return pbMap;
}
```
This is exactly the loop `buildSwimmerRows()` already ran inline before v2.10 — pulled out into its own named function so every current-PB consumer (`buildSwimmerRows()`, and therefore County/Regional and the Bubble List which both go through it) shares one definition. **Never stored or cached** — recomputed from the full array on every call, so an out-of-chronological-order entry (a coach backfilling an old result, or a future SE import seeding one historical point) can never leave a stale "current PB" flag behind, because there never is one to go stale.

### `computePbImprovements(pbs)` — Hot Right Now's redefinition

Groups dated entries by event+course, sorts each group chronologically, and walks forward tracking the best time seen so far; an entry counts as a "recent improvement" only if it beat everything strictly before it in that group. Undated entries are excluded entirely (unchanged convention). `collectRecentPbs()` now calls this instead of iterating every dated entry directly — required once `pbs` can hold non-improving history, or the feed would show every recorded swim, not just PBs.

`collectRecentPbs()` remains the one PB-reading path that bypasses `buildSwimmerRows()`'s `ALL_EVENTS`-constrained lookup (the same property flagged since the v2.6 stored-XSS fix) — this was explicitly re-verified for the widened schema this session, not assumed safe by inheritance; see `known-bugs-and-fixes.md`'s security-review note.

### `mergePbEntry()` — locked spec, implemented, not yet called

```
mergePbEntry(existingPbs, incoming) → { pbs, outcome, ...extra }
```
Identity: `event + course + date` (never `time`). Outcomes: `'add'` (auto-append, no review), `'noop'` (identity + time both match — nothing changes, **`source` is sticky**, never silently overwritten even if the incoming source differs), `'conflict'` (identity matches, time differs — surfaced via `existingEntry`/`incomingEntry`/`index`, resolved by a caller via `resolvePbEntryConflict(existingPbs, index, incoming, resolution)` where `resolution` is `'keep'` or `'incoming'`). Competition/venue handling on an add or an "incoming"-resolved conflict: `mergeCompetitionField()` + `isTruncatedFragmentOf()` implement the rule that a truncated (exactly-30-character, matching SE's confirmed export behaviour) fragment of a fuller existing competition string never overwrites it.

**Has no caller in this codebase yet.** v2.11's SE import is the function's intended first caller, per the plan doc's phased build order — v2.10's job was to implement and thoroughly test it ahead of that caller, against an already-locked spec, not to wire it into any existing flow.

### `resolvePbSourceOnSave()` — tagging PBs entered through Add/Edit Swimmer

`saveSwimmer()` rebuilds its whole `pbs` array from the modal's rows on every save (unchanged since before v2.10). To avoid silently reclassifying an untouched gala-synced PB as "manual" just because the form re-saved it, each resulting entry's `source` is resolved against what the swimmer already had on file (matched by event+course+date+time, same identity concept as `mergePbEntry()`): an unchanged match keeps its original source; anything new or genuinely edited is tagged `'manual'`.

---

## Overview Tab

Unchanged in v2.10 except where noted above (Hot Right Now's redefinition). Three sections, in this order: Squad Composition, Hot Right Now, The Bubble List. See prior versions of this file for the full shared-building-blocks writeup (`getOverviewEligibleSwimmers()`, `hiddenReasonDetail()`, `renderPersonCard()`, the entry-row design, section-level card caps) — none of that changed this session.

### Section 2 — Hot Right Now (redefinition detail)

`collectRecentPbs(limit, cutoffDate)` now filters through `computePbImprovements()` before applying the day-cutoff, rather than reading every dated PB directly. Ordering (most-recent-improvement-date first, then most-improvements-on-that-date as tiebreak) is unchanged — it's the same sort over a now-pre-filtered list.

### Section 3 — The Bubble List

Unchanged in v2.10. `buildBubbleList()` goes through `buildSwimmerRows()`, which now calls `getCurrentPbMap()` — same result as before for any swimmer with at most one entry per event+course, and now also correctly picks the genuinely fastest entry for a swimmer with several.

---

## Security Notes

### The v2.6 stored-XSS finding, and its v2.10 re-verification

Unchanged root cause and fix from v2.6 (see prior versions of this file for the full history) — `collectRecentPbs()` bypasses `buildSwimmerRows()`'s constrained lookup, so its safety comes entirely from `sanitiseSwimmersData()`'s validation at the point of entry, not from render-time escaping alone (though that's also present, as defense-in-depth). **v2.10 re-verified this explicitly for the widened schema**: the sanitiser's per-entry validation (`event`/`course`/`date`) never assumed "at most one entry per event+course," so widening cardinality doesn't change what validation each entry receives — confirmed with a synthetic swimmer holding a malicious `course` value planted in the *middle* of three same-event+course entries; the sanitiser drops exactly that one entry, keeps the other two. The new `source` field is validated as a plain enum-membership check, carrying no injection surface of its own.

### Validation, symmetric across upload, sync, AND restore (extended in v2.10)

- `sanitiseSwimmersData()` is called from `startSync()`, `loadSwimmersFile()`/`applySwimmersUpload()`, and `loadBackupFile()`/`applyBackupRestore()`. As of v2.10 it also validates per-PB `source` (drops just that field, keeps the PB, if present but not `gala`/`se`/`manual`) — every one of those callers gets the new check automatically, with zero changes to any of them, following the exact pattern `se` established in v2.9.
- **v2.10 is the second real proof of the v2.8 design bet**: Backup & Restore needed zero code changes for the widened schema, and this was verified directly (a dedicated probe check), not assumed just because it worked for `se` in v2.9.

### Write-side localStorage protection (unchanged since v2.6)

Unchanged in v2.10.

### Apps Script hardening (unchanged since v2.6)

Unchanged in v2.10 — no Apps Script edits this session.

### Accessibility (unchanged since v2.6)

Unchanged in v2.10 — no new UI surfaces were added (mergePbEntry has no UI yet).

---

## Data Flow

```
localStorage
  ↓
SWIMMERS (array, pbs now possibly multi-entry-per-event+course, each entry optionally source-tagged)
  ↓
renderOverview() → renderHotList() → collectRecentPbs() → computePbImprovements()  (v2.10)
                  → renderBubbleList() → buildBubbleList() → buildSwimmerRows() → getCurrentPbMap()  (v2.10)
renderTab(prefix) → buildSwimmerRows() → getCurrentPbMap()  (v2.10)

Data-entry paths, all validated + write-checked (unchanged call sites, extended validation):
  applySwimmersUpload / startSync  → sanitiseSwimmersData()  → lsSet('coach_SWIMMERS', ...)
  loadBackupFile → applyBackupRestore()  → sanitiseSwimmersData()  → lsSet(...)
  saveSwimmer() → resolvePbSourceOnSave() per PB row → lsSet('coach_SWIMMERS', ...)  (v2.10)

mergeSwimmers() → mergePbs()  (RE-KEYED, v2.10 bug fix — see known-bugs-and-fixes.md)

mergePbEntry() / resolvePbEntryConflict()  — standalone, v2.10, no caller yet (v2.11's job)
```

---

## Testing

`test_overview.js` — Section 7's stale fixture (`sw_bubble_hidden_test`) rebuilt this session to compute its dob/QT relationship dynamically, the same way Section 12's tie-break test already did, rather than a hardcoded value that "aged into" already-qualified status as real time passed (Open Issue #7, now fixed). Re-run against both the unmodified v2.9 baseline and the finished v2.10 build: **zero failures on either**, confirming the fixture rewrite alone was the complete fix and this session's actual code changes introduced no Overview-tab regression.

`probe_pbs_widening.js` (new, v2.10, not part of the shipped dashboard) — 45 checks, per the plan doc's Section 3.3 sign-off requirement (this is the first of the four SE-import-roadmap sessions where the change genuinely touches what `test_overview.js` asserts on, so both a full suite run and a dedicated probe were required). Covers everything in this document's "v2.10" section above, plus the `mergePbs()` bug-fix reproduction and the Backup & Restore compatibility verification. All 45 passed. `node --check` clean throughout.

See `known-bugs-and-fixes.md`'s "Added in v2.10" section for the complete list of what was verified and how.
