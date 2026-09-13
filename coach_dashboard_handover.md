# Coach Dashboard — Handover Document (v2.7 → starting v2.8)

**File:** `index.html` · **Lines:** ~3,940 · **Self-contained:** yes (logo embedded as base64) · **Test harness:** `test_overview.js` (jsdom, dev-time only — not shipped) + a one-off `probe_fixes.js` from v2.7 (not a permanent suite)

---

## 1. What Changed Last Session (v2.7)

A short, two-bug mobile follow-up session — **no features, no schema changes.** Both bugs were reported with screenshots and both turned out to be symptoms the v2.6 session thought it had already fixed, but hadn't fully closed. Full detail in `known-bugs-and-fixes.md`'s "Fixed in v2.7" section and `session-log.md`; condensed version below.

### Bug 1 — gender pill still taller than the squad badge

v2.6's fix (shared `line-height: 15px` on `.gender-pill-mobile` and `.squad-badge`) addressed the wrong layer — `line-height` constrains the line box, not the glyph's own rendered ink, and the ♀/♂ characters could still visually overflow a "correctly sized" box on some mobile rendering paths even with identical CSS. v2.7's actual fix:

1. Both pills now use an explicit fixed `height: 19px` + `display: inline-flex; align-items: center; justify-content: center`, replacing the line-height approach entirely.
2. The ♂/♀ HTML entities now carry the Unicode text-presentation variation selector (U+FE0E) immediately after them — `&#9794;&#xFE0E;` / `&#9792;&#xFE0E;` — explicitly requesting the plain monochrome glyph over any colour/emoji substitution.

### Bug 2 — Manage Data status message overlapping Close / Clear All Data

v2.6's sticky-bottom status dock CSS (`margin-bottom: -20px` to bleed flush with the modal edge) implicitly assumed it was the last element in the modal. It wasn't — the Clear All Data / Close button row followed it in the markup, so the negative margin pulled that row up underneath the dock. **Fix:** pure DOM reorder — the button row now precedes the dock, which is the genuine last child of the modal box. No CSS changed.

### Process note worth repeating for any future session

Both v2.7 fixes replaced a v2.6 fix that looked complete at the time (plausible CSS, no test failures) but didn't actually close the reported gap, because the earlier diagnosis was of a real-but-incomplete cause. **If a bug report describes something "already fixed" reappearing, re-derive the root cause from the current code rather than assuming the old fix just needs reinforcing.** Both v2.7 fixes were verified with a small dedicated jsdom probe (`probe_fixes.js`) asserting the actual property that mattered (`getComputedStyle` height/alignment equality; DOM order via `compareDocumentPosition`/`lastElementChild`) — not just "the CSS rule exists" or "the markup is present."

### Housekeeping
`index.html`'s `<title>` bumped to v2.7. When reconstructing the file locally for jsdom testing, the embedded base64 logo was temporarily stubbed with a placeholder to make local iteration lighter-weight — **this was correctly restored and re-verified before the file was delivered**, but it's a real risk worth flagging for any future session doing the same reconstruction trick: don't ship a locally-rebuilt copy without confirming binary/embedded assets made it back in unchanged.

---

## 2. What's Being Planned Next (v2.8 candidate) — SE PB Import & PB History

**This is planning only. Nothing described here has been implemented.** It comes from a separate chat, not a dev session, but the coach has already reviewed and approved the core idea. Full detail, reasoning, and every open item lives in **`se-pb-import-and-history-plan.md`** — read that file in full before writing any code for this. What follows is a condensed map of it, enough to get oriented, not a substitute for reading it.

### The shape of the feature

The coach wants to cross-check the dashboard's manually-tracked ("gala") PBs against each swimmer's *official* Swim England PB record, by uploading two report files the coach exports themselves from their own SE App account (one Short Course, one Long Course — both `.xlsx`). This is explicitly framed to the coach as **a validation tool, not a replacement data source** — that framing is why it got approved, and it constrains the design throughout.

### The path that was ruled out, and why

The original idea — auto-fetching each swimmer's public SE results page using the "SE #" already in the Google Sheet — was tested (it works technically, no bot-block) and then **explicitly rejected** on Swim England's own Website Terms of Use grounds: they prohibit systematic downloading/database-building from the site, and this is personal data on named minors from the sport's governing body. Not a risk call — a hard no. Don't revisit this path without the coach independently pursuing Swim England's official "interoperable program" access channel first.

### The three hard constraints that shape everything

1. **This import can only ever update PB *times* on swimmers that already exist.** It must never create, delete, or hide a swimmer, and must never touch `squad`. SE reports have no squad field, and structurally can't list a swimmer with zero recorded SE times or without an SE# on file — treating this as an authoritative snapshot would silently drop real swimmers from the roster. This is deliberately the same lesson already learned once in this codebase: `mergeSwimmers()`'s `sourceIsAuthoritative` flag exists because an earlier real bug (v2.2.1) treated a partial import as a complete snapshot and dropped absent swimmers. The SE import must permanently use the "not authoritative" merge path — this is a structural design constraint, not a toggle a future coach could accidentally flip.
2. **A conflicting existing PB is never auto-resolved.** The coach has flagged that the SE App itself sometimes has gaps/errors, so a conflict (existing PB differs from the incoming SE value for the same swimmer/event/course) must be surfaced for a per-row coach decision — no global Replace/Merge switch like the one used elsewhere in the app for QT/swimmer uploads. This means each PB entry needs its own provenance tag (`gala`/`se`/`manual`), not just the existing swimmer-level `source` field.
3. **Matching is SE#-first, name+DOB-fallback, and unmatched rows are skipped, never ghost-created.** A swimmer without a stored SE# gets matched by name+DOB (same normalisation the Sheets sync already does) and has the SE# backfilled onto their record for future imports. If neither matches, the row is skipped and reported to the coach — never silently creates a new swimmer profile.

### What's genuinely new in the schema (planned, see `data-schema.md` §9 for the authoritative version)

- `se` (string) on the swimmer record — the SE#.
- `source` (`"gala"`/`"se"`/`"manual"`) on each PB entry — needed for the conflict-review UI to say where each competing value came from. Existing PB entries with no `source` should probably default to `"gala"` rather than needing a backfill pass — this migration decision is still open.

### What else is in the plan, lower priority / sequenced later

- **Backup & Restore** (single-file full-snapshot download/restore, replace-only, deliberately excludes sync credentials) — sequenced *after* the SE-import schema changes land, so it's designed once against the final shape.
- **PB history/progression tracking** (retain superseded PBs instead of discarding them on overwrite) — a newer, much less-formed ask that surfaced at the very end of the planning conversation. **Explicitly not designed yet** — needs its own dedicated design pass across every PB-writing entry point (manual add/edit, Sheets sync, and the SE import once built) before any schema work starts. Do not attempt this opportunistically alongside the SE import itself; see plan doc §5 for the open questions (data shape, deduplication identity, cross-source consistency, UI implications).

### Hard blocker before implementation can start

**No real sample SE report file has been provided yet** — only screenshots. The coach said they'd send one "shortly." Do not start parser work from the screenshots alone; merged cells, whitespace, encoding, and exact column typing don't show up reliably in a screenshot, and the report's inconsistent blank-row spacing (confirmed from the screenshots) makes this specifically risky to get subtly wrong. If a fresh v2.8 session starts and this file still hasn't arrived, that's the first thing to chase down, not something to work around.

### A suggested build order exists

`se-pb-import-and-history-plan.md` §8 has a proposed (not committed) sequence: get the real sample file → confirm `.xlsx` parsing via SheetJS against it → build the block parser → add the schema fields → build matching → build conflict review → wire the two-file upload UI → *then* Backup & Restore → PB history is its own later pass. Worth following roughly as-is unless something in the real sample file invalidates an assumption.

---

## 3. Things Deliberately NOT Done (carried forward, still accurate)

- **Sync token as a URL query param, not a header** (Open Issue #1) — real fix, needs a coordinated `doPost` change to the `.gs` file. Reviewed again in v2.6, left for a focused future turn. Unchanged in v2.7.
- **Single shared sync token, no per-coach revocation** (Open Issue #2) — a genuine *feature* (per-coach identity/token issuance in Apps Script), not a "fix," and already a documented, accepted trade-off in `project-brief.md`.
- **Swimmer `id` still unvalidated**, unrecognised `squad` values still just displayed as-is, QT `age` bracket strings only checked for "non-empty string" not against the actual valid set per championship — all flagged as remaining small gaps (Open Issue #5), none security-relevant, all low priority.
- **GitHub sync retry doesn't cover genuine extended offline periods** (Open Issue #4) — covers the common transient case; a longer-lived "you're offline" state is a bigger feature, not attempted.
- **The SE PB import and PB history work** (Section 2 above) — approved in principle, fully planned in `se-pb-import-and-history-plan.md`, zero code written.

If any of these come up as a request, the reasoning above is still valid — no need to re-litigate from scratch, but also no reason not to build them properly if actually wanted.

---

## 4. Architecture — What Changed in v2.7 (full detail in `architecture.md`)

### Changed in v2.7

| Area | What changed |
|---|---|
| `.squad-badge` / `.gender-pill-mobile` CSS | Rewritten from line-height-matching to fixed `height` + `inline-flex` centering |
| Gender glyph markup | `&#9794;&#xFE0E;` / `&#9792;&#xFE0E;` — added the U+FE0E text-presentation selector |
| Mobile media query | `.gender-pill-mobile` display changed from `inline-block` to `inline-flex` |
| Manage Data modal markup | Clear All Data / Close button row moved to precede `#dataModalStatusDock` in the DOM |

### Things to know before touching this code (still true, some restated from v2.6 for a fresh reader)

- **`collectRecentPbs()` is the one PB-reading path without the "safe by construction" property** — it reads `sw.pbs` directly rather than through the `ALL_EVENTS`-constrained lookup every other tab uses. **This is directly relevant to the planned SE import**: whatever code eventually writes SE-sourced PBs must go through `sanitiseSwimmersData()` (or an equivalent enforcing the same `pb.event`/`pb.course`/`pb.date` constraints) before persisting — don't assume a new import path inherits safety it hasn't earned.
- **`saveQTToStorage()` returns true/false** — check the result if you add a new caller.
- **`sanitiseSwimmersData()` returns `{ clean, skipped, datesDropped }`**, not a plain array — destructure accordingly if calling it directly.
- **Every `localStorage.setItem()` should go through `lsSet()`, every read through `lsGet()`** — firm convention, not a suggestion.
- **The Manage Data modal's status dock (`#dataModalStatusDock`) must remain the last child of `.modal-box`.** If a future session adds new content to that modal (e.g. an SE-import upload card, per the plan above), make sure it's added *before* the dock in the DOM, not after — that's exactly the bug v2.7 just fixed, and it's easy to reintroduce by accident when adding new UI to this specific modal.

---

## 5. Testing Approach

Standing convention, reconfirmed in v2.7: extract `<script>` → `node --check` → run `test_overview.js` (when the change touches anything it covers) → confirm with a real rendered sample or `getComputedStyle`/DOM-state assertion, not just markup presence. **v2.7 additionally demonstrated the value of a small one-off probe for a plain CSS/DOM-structure bug** (`probe_fixes.js` — not a permanent suite, written to prove the two specific v2.7 fixes) — the same "prove the actual property, not just that code exists" discipline previously reserved for security/accessibility fixes in v2.6 applies just as well to visual/layout bugs. Worth defaulting to this pattern for any future targeted bug fix rather than reasoning about CSS in the abstract.

**For the SE import work specifically**, when that starts: build a parser-level test against the real sample file *before* wiring it into the UI (this is a new, comparatively risky parsing surface — inconsistent blank-row spacing was already flagged from screenshots alone), and write a dedicated matching/conflict-detection test using synthetic swimmers with deliberately overlapping/conflicting PBs, mirroring how `test_overview.js`'s tie-break tests use synthetic fixture data rather than hoping the real sample data happens to exercise every branch.

`test_overview.js` needs `swimmers_pb.json` to run, which is **not committed to the repo** (contains real squad data). If a fresh session needs to run it without the real file, generate a small synthetic one matching the schema in `data-schema.md` (§1) purely for local test runs, and discard it afterward — same approach used in prior sessions.

---

## 6. Suggested Directions for v2.8 (not commitments, just where things were left)

| Priority | Idea |
|---|---|
| **Blocking, not started** | Get the real sample SE report file from the coach — nothing in Section 2 can safely start without it |
| High (once unblocked) | Begin `se-pb-import-and-history-plan.md`'s suggested build order — SheetJS integration → block parser → schema fields → matching → conflict review → upload UI |
| Carried over | `doPost` + JSON-body token fix for Sheets sync (Open Issue #1) |
| Carried over | Per-coach sync auth (Open Issue #2) — a real feature, not a quick fix |
| Sequenced after SE import lands | Backup & Restore (single-file bundle, replace-only) |
| Needs its own design session | PB progression/history tracking — do not bolt onto the SE import |
| Low | Validate/regenerate swimmer `id`; normalise unrecognised `squad` values; check QT `age` against the real valid bracket set |

---

## 7. Files — Current State

| File | Version | Description |
|---|---|---|
| `index.html` | v2.7 | Main dashboard |
| `apps_script_v2.2.2.gs` | v2.2.2 | Unchanged since v2.6 |
| `test_overview.js` | v2.5 | jsdom dev-time harness — not shipped, unchanged this session |
| `README.md` | v2.7 | Landing pointer to the docs below |
| `project-brief.md` | v2.7 | |
| `architecture.md` | v2.7 | |
| `data-schema.md` | v2.7 | Now includes a clearly-marked §9 for the planned (not yet built) SE-import schema additions |
| `known-bugs-and-fixes.md` | v2.7 | |
| `session-log.md` | v2.7 | Full turn-by-turn history |
| `se-pb-import-and-history-plan.md` | new | Full carried-forward plan for the SE PB import & PB history feature — read this before starting v2.8 |
| `coach_dashboard_handover.md` | this file | |
