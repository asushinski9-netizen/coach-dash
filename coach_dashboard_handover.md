# Coach Dashboard — Handover Document (v2.6 → starting v2.7)

**File:** `index.html` · **Lines:** ~3,910 · **Self-contained:** yes (logo embedded as base64) · **Test harness:** `test_overview.js` (~430 lines, jsdom, dev-time only — not shipped)

---

## 1. What Changed This Session (v2.6)

No new features, no data-schema changes. This was a **hardening pass**: two direct mobile bug reports, then a full user-requested codebase review (security/bugs/UI/accessibility/code-quality), all 20 items from that review rolled out, plus two more found while implementing them, plus one follow-up mobile UX fix. Full detail in `known-bugs-and-fixes.md`'s "Fixed in v2.6" section and `session-log.md`; this is the condensed version.

### The two direct bug reports (handled first, before the review)
1. **Gender-pill / squad-badge height mismatch on mobile** — two pills next to each other rendering at different heights. Root cause: different `line-height` *strategies* (relative vs. default) on top of different `font-size`s meant the boxes could never match regardless of padding. Fixed with a shared fixed `line-height: 15px`.
2. **Bubble List event text wrapping on some phones** — looked like "font too big," was actually a CSS specificity bug: the course badge nested inside `.ov-entry-stat-meta` was never picking up the generic mobile `.badge` override at all, so it stayed at desktop size. Fixed with a matching-specificity override. Since Hot Right Now shares the same class, one fix covered both, satisfying the "keep it consistent" ask without a separate change.

### The review → 20-item list → all rolled out, plus 2 more found along the way
Categories: security, bugs, UI/accessibility, improvement opportunities. Headline items:

- **A real stored-XSS vulnerability**, found while adding an *unrelated* defense-in-depth fix. Hot Right Now bypasses the safe `ALL_EVENTS`-constrained lookup path every other tab uses, and rendered `pb.course` unescaped in a class attribute, with zero validation of `pb.event`/`pb.course` anywhere. Fixed at the sanitiser (root cause) and at render time (defense-in-depth). **If you're looking for the single most important thing from this session, it's this.**
- Every `localStorage` write is now protected (`lsSet()`) and failures are surfaced to the coach, not swallowed.
- Sync-path swimmer data now gets the same validation manual uploads always got (previously bypassed entirely).
- QT data (both upload and GitHub sync) is validated for the first time at all (`sanitiseQTData()`).
- Full keyboard/screen-reader support added where there was none: clickable divs (`kbActivate()`), all four modals (real dialog semantics + focus trap/restore), FAB buttons (`aria-label`).
- Apps Script hardened (constant-time-ish token compare, `setToken()` overwrite guard) → file renamed `apps_script_v2.2.2.gs`.
- GitHub QT sync now retries transient failures instead of failing on the first blip.
- Overview's day-cutoff/margin% now persist across reloads (its other session state stays ephemeral, unchanged, on purpose).
- `.tbl-wrap` (QT Editor) had zero CSS at all — found and fixed along the way.

### The follow-up fix (after the review shipped)
**Manage Data modal warnings hidden below the fold on mobile.** Status/error/conflict messages sat in normal flow below three data-cards; on mobile, an upload-triggered conflict or sync error could go unnoticed without scrolling down. Fixed with a mobile-only sticky dock that appears the instant there's something to show and vanishes otherwise. Desktop untouched, per explicit request.

### Housekeeping
`index.html`'s `<title>` tag was found stale (still said "v2.2"), corrected to v2.6. The stale, abandoned `README.md` (a v1.0-era artifact, never updated alongside `project-brief.md`, still referencing a `coach_dashboard.html` filename that hasn't existed in years) was replaced with a lean pointer to the maintained docs.

---

## 2. The Stored-XSS Finding — Full Detail (read this one carefully)

**Where:** `collectRecentPbs()`, which feeds Hot Right Now on the Overview tab (the default landing tab).

**Why it existed:** every other tab (County, Regional, The Bubble List) gets its PB rows from `buildSwimmerRows()`, which iterates the fixed `ALL_EVENTS` array and a fixed `['S','L']` course list — so whatever ends up in `r.event`/`r.course` is *safe by construction*, regardless of what garbage might be sitting in the raw swimmer data. Hot Right Now, alone, reads `sw.pbs` directly. Combined with `sanitiseSwimmersData()` validating `pb.time` but not `pb.event`/`pb.course` at all, a manually-uploaded (or Sheet-sourced) PB with a crafted `course` string like `"><img src=x onerror="...">` would reach `<span class="badge ${e.course}">` completely unescaped and break out of the attribute.

**Fix (both layers, don't remove either):**
1. `sanitiseSwimmersData()` now validates `pb.event` against `ALL_EVENTS` and `pb.course` against `'S'`/`'L'`, dropping the PB if either fails.
2. `escHtml(e.course)` at render time in both Hot Right Now and Bubble List (Bubble List's was already safe by construction — that one's just consistency).

**Verified with a dedicated jsdom probe** (not part of `test_overview.js` — written fresh for this): confirmed the sanitiser rejects the payload, and separately confirmed that even if something bypassed the sanitiser, the payload renders as inert text with zero script execution and zero `<img>` elements actually created in the DOM.

**Lesson for future sessions:** if you ever touch `collectRecentPbs()` or add a new field to what it reads from `sw.pbs`, remember it does NOT get the "safe by construction" property that the rest of the app's PB-rendering paths get for free. Anything it reads from raw PB data needs either validation at the sanitiser or escaping at render (ideally both, as done here) — don't assume "well, County/Regional handle this fine" transfers to this function.

---

## 3. Things Deliberately NOT Done (and why)

- **Sync token as a URL query param, not a header** (Open Issue #1) — real fix, needs a coordinated `doPost` change to the `.gs` file. Explicitly reviewed again this session and left for a focused future turn rather than squeezed in.
- **Single shared sync token, no per-coach revocation** (Open Issue #2 in the current log) — this is a genuine *feature* (per-coach identity/token issuance in Apps Script), not a "fix," and it's already a documented, accepted trade-off in `project-brief.md`. Didn't bolt on a partial version of this.
- **Swimmer `id` still unvalidated**, unrecognised `squad` values still just displayed as-is, QT `age` bracket strings only checked for "non-empty string" not against the actual valid set per championship — all flagged as remaining small gaps (Open Issue #5 in the current log), none of them security-relevant post-escaping, all low priority.
- **GitHub sync retry doesn't cover genuine extended offline periods** (Open Issue #4) — the retry-with-backoff added this session covers the common transient case (a blip, a momentary 5xx); a longer-lived "you're offline, we'll retry when you're back" state is a bigger feature, not attempted.

If any of these come up as a request, the reasoning above is still valid — no need to re-litigate from scratch, but also no reason not to build them properly if actually wanted.

---

## 4. Architecture — What's New (full detail in `architecture.md`)

### New functions/constants this session

| Area | Names |
|---|---|
| Storage safety | `lsSet`, `warnStorageFailureOnce`, `checkLocalStorageSize` (now also alerts once, not just console), `migrateLegacyQTKey` |
| Validation | `sanitiseQTData`, `describeSanitiseIssues`, `describeSanitiseQTIssues` (`sanitiseSwimmersData` extended, not new — now also validates `pb.event`/`pb.course`/`pb.date`, and is called from `startSync()` too) |
| Accessibility | `kbActivate`, `openModalA11y`, `closeModalA11y`, `getFocusableIn`, `trapModalTab` |
| Manage Data mobile fix | `refreshStatusDockVisibility` |
| Misc | `debounce`, `debouncedRenderCounty`, `debouncedRenderRegional`, `fetchWithRetry`, `HOT_RAW_POOL_CAP` (named constant, same value as before) |

### Things to know before touching this code

- **`collectRecentPbs()` is the one PB-reading path without the "safe by construction" property** — see Section 2 above. Keep this in mind for anything touching Hot Right Now.
- **`saveQTToStorage()` now returns true/false** (previously void) — if you add a new caller, check the result; every existing caller already does.
- **`sanitiseSwimmersData()`'s return shape changed** from a plain array to `{ clean, skipped, datesDropped }` — if you call it directly anywhere new, destructure accordingly (every existing call site already does).
- **`applySwimmersUpload`/`applyQTUpload` gained a trailing optional `note` param** (sanitiser warnings, appended to the success message) — `showDataConflict`/`resolveDataConflict` carry it through the Replace/Merge confirmation step via `_pendingConflict.note`.
- **The Manage Data modal's status dock (`#dataModalStatusDock`) needs `refreshStatusDockVisibility()` called after any new code that shows/hides `dataStatus`/`dataError`/`dataConflictBox` directly** — every existing call site does this already; a new one that sets `.style.display` directly without going through `setDataStatus()`/`setDataError()`/`showDataConflict()`/`cancelDataConflict()` would need the explicit call.
- **Every `localStorage.setItem()` should go through `lsSet()`, every read through `lsGet()`** — this is now a firm convention, not a suggestion. A raw `localStorage.setItem()` call anywhere is a regression back to the pre-v2.6 silent-failure state.

---

## 5. Testing Approach

Same standing convention as prior sessions, reconfirmed this session: extract `<script>` → `node --check` → run `test_overview.js` → confirm with a real rendered sample or `getComputedStyle`/DOM-state assertion, not just markup presence. **v2.6 additionally used several one-off jsdom probes** written specifically to verify the security/accessibility-sensitive changes (an XSS probe, an accessibility probe covering dialog semantics + focus trap/restore + keyboard activation, a retry-logic probe against a mocked flaky `fetch`, a status-dock-visibility probe). These weren't folded into `test_overview.js` permanently since they verify one-off fixes rather than serving as ongoing regression coverage — but the pattern is worth reusing: **for a security or accessibility fix specifically, write a probe that proves the actual property you care about** (e.g. "no script executes" / "focus actually lands inside the modal" / "the retry actually retried"), not just "the code runs without throwing."

`test_overview.js` itself needs `swimmers_pb.json` to run, which is **not committed to the repo** (contains real squad data) and wasn't available in this session's uploads either — a synthetic one was generated locally purely to run the suite, then discarded. If a fresh session needs to run this test file, it'll need either the real file or a freshly-generated synthetic one matching the schema in `data-schema.md`.

---

## 6. Suggested Directions for v2.7 (not commitments, just where things were left)

| Priority | Idea |
|---|---|
| Carried over | `doPost` + JSON-body token fix for Sheets sync (Open Issue #1) |
| Possible | Per-coach sync auth (Open Issue #2) — a real feature if the club ever wants individual revocation, not a quick fix |
| Possible | Extend `sanitiseQTData()`'s `age` check to the actual valid bracket set per championship, rather than just "non-empty string" |
| Possible | A genuine "offline" state for GitHub sync, distinct from a generic retry-then-error |
| Low | Validate/regenerate swimmer `id` on manual upload; normalise unrecognised `squad` values instead of displaying as-is |
| Low | Fold the v2.6 one-off jsdom probes (XSS, a11y, retry, status-dock) into `test_overview.js` proper if any of that surface area gets touched again — would be nice permanent regression coverage rather than one-off verification |

---

## 7. Files — Current State

| File | Version | Description |
|---|---|---|
| `index.html` | v2.6 | Main dashboard |
| `apps_script_v2.2.2.gs` | v2.2.2 | Token-check + `setToken()` hardening this session (renamed from `_v2_2_1`) |
| `test_overview.js` | v2.5 | jsdom dev-time harness — not shipped, confirmed still passing in full against v2.6 |
| `README.md` | v2.6 | Rewritten this session — was a stale v1.0-era artifact, now a lean pointer to the docs below |
| `project-brief.md` | v2.6 | |
| `architecture.md` | v2.6 | |
| `data-schema.md` | v2.6 | |
| `known-bugs-and-fixes.md` | v2.6 | |
| `session-log.md` | v2.6 | Full turn-by-turn history |
| `coach_dashboard_handover.md` | this file | |
