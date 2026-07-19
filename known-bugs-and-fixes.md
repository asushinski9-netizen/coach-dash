# Coach Dashboard — Known Bugs & Fixes (v2.6)

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script Web App as `${syncUrl}?token=${token}`. Risks the token landing in browser history and server/proxy access logs. Correct fix is a `doPost` handler reading the token from the JSON request body — requires a coordinated change to `apps_script_v2.2.2.gs`. **Still not fixed.** Explicitly reviewed again during the v2.6 security pass and deliberately left for a future session — it's a real, if low-urgency, fix and deserves its own focused turn rather than being squeezed in alongside everything else this session touched.

### 2. Single shared sync token, not per-coach
One `ACCESS_TOKEN` in Apps Script Script Properties, shared by every coach. Documented accurately in the Settings modal. No way to revoke one coach's access without changing the token for everyone. **Deliberately not addressed in v2.6** — real per-coach auth needs an Apps Script schema change (issuing/tracking/revoking individual tokens, a coach-identity concept) that's a genuine feature, not a fix; flagged during the v2.6 review but intentionally left as the documented, accepted trade-off it already was rather than bolting on something partial.

### 3. Apps Script quota
Apps Script has a daily execution quota (~20,000 calls on personal accounts). No rate limiting implemented. Low risk for single-coach use. Unchanged.

### 4. GitHub QT sync has no *offline* handling
v2.6 added retry-with-backoff for transient failures (`fetchWithRetry()` — see Fixed section), which covers the common case (a dropped connection, a momentary GitHub 5xx). What's still missing: no queued/deferred retry if the coach is genuinely offline for longer than the retry window, and no visual "you're offline" state distinct from a generic error.

### 5. Manual-upload/sync validation still isn't exhaustive
v2.6 closed the major gaps (swimmer `dob`/`gender`/PB `time`/`event`/`course`/`date`, and QT `gender`/`course`/`event`/`age`/`qualify`/`consider` — see Fixed section), on both the manual-upload AND sync/GitHub paths now. Not yet validated: swimmer `id` (still not regenerated/checked — not a security issue post-v2.4's escaping fixes, just a data-quality gap), `squad` value (an unrecognised string is just displayed as-is rather than normalised), and QT `age` bracket strings aren't checked against the actual set County/Regional use (`10+11`…`17+` / `11/12`…`18+`) — just checked for being a non-empty string.

---

## Fixed in v1.0

- Squad not saving on edit (`saveSwimmer` spread missing `squad` in edit path)
- `buildProgressBar` negative range on inverted QT data
- `calcStatus` misclassification on inverted QT data
- Gender pill visible on desktop (CSS specificity issue)
- Script truncation (heredoc limit) — `node --check` now run after every session
- Broken template literal in "Not offered" row onclick
- Dead `noPBFg` variable in `renderTab`

---

## Fixed in v2.1

- `squad-former-swimmer` CSS class never matched `.squad-former` selector
- `esc`/`esc2` inconsistency — unified into module-level `escAttr()`
- Duplicate comment in `renderQTEditor`
- Unescaped `innerHTML`/`onclick` injections wrapped with `escHtml()`/`escAttr()`
- No DOB/time validation on file load — sanitisation added
- Inconsistent `toFixed(3)` vs `toFixed(2)` — standardised to `toFixed(2)`
- Startup `JSON.parse` without try/catch — `lsGet()` helper added
- Footer note hardcoded "SE London Regional" — now reads from `REGIONAL_QT_META.title`

---

## Fixed in v2.2.1 (Gemini regression + security)

Wrong localStorage key, wrong variable casing, spurious `window.location.reload()`, `mergeSwimmers()` defined but never called. Token moved from hardcoded source to `localStorage`/`PropertiesService`; `openById(SHEET_ID)` → `getActiveSpreadsheet()`; deployment changed to "Anyone" (token is the auth gate).

---

## Fixed in v2.3

Removed hardcoded championship date constants · removed `loadSampleData()` · removed duplicate stale `#syncModal` block and duplicate `fabShowSyncModal()` · County/Regional GitHub QT sync added · Manage Data modal redesigned · conflict resolution (Replace/Merge) added · Clear Data added · Download/Clear buttons disabled when empty · cross-reference hints added · `refreshDataModalStatus()` consolidated.

---

## Fixed in v2.4

- **`mergeSwimmers()` silently dropped all Sheets-synced swimmers on a manual-upload merge** — added `opts.sourceIsAuthoritative`.
- **Diagnostics — "why isn't this swimmer showing"** — built out `no-match`/`no-pbs`/`filtered`/`former`/`hidden` categories in an expandable footer note.
- **Sync modal's own "Last synced" timestamp never refreshed after Clear Data** — now re-read on every modal open.
- **Sync timestamps displayed in browser-locale format** — added `fmtDateTime()` for a fixed `DD/MM/YYYY, HH:MM`.
- **Championship banner misstated multi-day events as single-day** — added `describeChampDates()`.
- **Collapse All wasn't the default state** — now default and re-applied on every tab (re-)open.
- **Three stored-XSS vulnerabilities** found via full codebase review and fixed: `escAttr()` double-layer escaping, QT editor `gender`/`event` raw-HTML injection, unescaped `sw.gender` in the swimmer card meta line.

---

## Fixed in v2.5

### Real production bug
- **Mobile Age-composition legend digit truncation.** Some 2-digit ages (12, 13, 14, 15) rendered as a bare "1" with no ellipsis; others (16, 17, 18, 19) rendered correctly. Root cause: `.ov-legend-label { min-width: 0 }` let a long *adjacent* count string (e.g. `"15 (18%)"`) squeeze that row's label down to sub-one-character width before any ellipsis had room to render. **Fix:** `min-width: 2.4ch`.

### Design iteration
Hot Right Now / Bubble List entry rows went through several rounds based on direct feedback (flat row → CSS grid → two-line "time as hero stat" → grouped result block → stroke accent bar). A leading `+` sign on the Bubble List's time-difference stat was removed as ambiguous.

### Test-suite bugs (in `test_overview.js`, not the shipped dashboard)
A "default margin is 5%" assertion that ran after a mutation; a tie-break test whose fixture didn't actually tie. Both fixed.

---

## Fixed in v2.6

This was a two-part session: two direct mobile bug reports (gender/squad badge height mismatch, and Bubble List event text wrapping on narrow phones), followed by a full deliberate codebase review (security, bugs, UI/accessibility, code quality) producing a 20-item list, all of which were rolled out — plus two additional issues found *while implementing* those 20 that weren't on the original list. One more mobile UX fix (Manage Data status visibility) was done in a follow-up turn. See `session-log.md` for the full turn-by-turn narrative; this section groups the same work by outcome.

### Real production bugs found and fixed
- **Mobile gender-pill / squad-badge height mismatch.** `.gender-pill-mobile` used a relative `line-height: 1.6` while `.squad-badge` used the browser default; combined with their different `font-size`s, the two pills could never render at the same height no matter how padding was tuned. **Fix:** both now share a fixed `line-height: 15px` and `padding: 2px 8px`, so box height is identical regardless of font-size.
- **Bubble List / Hot Right Now event text wrapping on narrow phones.** Root cause wasn't "font too big" — `.ov-entry-stat-meta .badge` (two-class selector) was more specific than the generic mobile `.badge` rule, so the SC/LC course badge inside these entries **never actually shrank on mobile at all**, staying at full desktop size next to already-abbreviated event text. **Fix:** added a matching-specificity mobile override; also tightened `.ov-entry-stat-meta`'s own font-size/gap. Fixes both sections at once since they share the class.
- **Real stored-XSS vulnerability, found while fixing a defense-in-depth item.** Hot Right Now's `collectRecentPbs()` reads `sw.pbs` directly, bypassing the `ALL_EVENTS`/`'S'|'L'`-constrained lookup path that County/Regional/Bubble List all use — and rendered `pb.course` **completely unescaped** in a `class="badge ${e.course}"` attribute, with no validation of `pb.event`/`pb.course` anywhere in `sanitiseSwimmersData()` at the time. A manually-uploaded (or compromised-Sheet) PB with a crafted `course` string could break out of that attribute. **Fixed at the root** (sanitiser now validates `pb.event` against `ALL_EVENTS` and `pb.course` against `'S'`/`'L'`, dropping the PB if either is invalid) **and at render time** (both occurrences of `e.course` now escaped, as defense-in-depth). Verified with a dedicated XSS probe (payload rejected by the sanitiser; when injected directly bypassing the sanitiser, renders as inert escaped text with no `<img>` element created and no script execution).
- **`.tbl-wrap` (QT Editor's table wrapper) had no matching CSS rule at all** — the class was used in `renderQTEditor()`'s markup but nothing defined it, so the table had no horizontal-scroll containment on narrow desktop windows. Added the missing `overflow-x: auto`, mirroring `.swimmer-table-wrap`.
- **Manage Data modal warnings hidden below the fold on mobile.** Status/error/conflict messages sat in normal document flow below three data-cards; on a short mobile viewport, an upload-triggered merge conflict or sync error could go completely unnoticed unless the coach scrolled down afterward. **Fix:** wrapped the three elements in a dock that becomes `position: sticky` at the bottom of the modal's scroll area (mobile only) the moment any of them has something to show, and disappears (no empty floating bar) otherwise. Desktop unchanged.

### Security hardening
- **Every `localStorage.setItem()` write was previously unwrapped** — only reads (`lsGet()`) had try/catch. Added a symmetric `lsSet()`; every write site now checks the result and surfaces a real message (a dedicated status banner where one exists, or a shared one-time `warnStorageFailureOnce()` alert where it doesn't) instead of throwing uncaught and silently failing.
- **Sheets-synced swimmer data bypassed `sanitiseSwimmersData()` entirely** — only the manual-upload path was validated. Now both paths run through the same sanitiser.
- **PB `date` was never validated** — a malformed date rendered as "NaN undefined NaN" and could corrupt Hot Right Now's string-based sort/cutoff. Now: an invalid date is dropped (PB itself is kept, same as any other undated PB), a valid one is kept as-is.
- **QT upload/sync had zero field validation** (Open Issue #7, pre-v2.6) — added `sanitiseQTData()`, applied to both the manual-upload and GitHub-sync paths. Validates `gender`/`course`/`event`/`age`, and coerces numeric-string `qualify`/`consider` values rather than rejecting them outright (a hand-edited JSON file producing `"34.5"` instead of `34.5` is a formatting slip, not bad data).
- **Apps Script `doGet()` token check hardened** — `safeCompare()` replaces a plain `!==`, closing a theoretical timing side-channel (very low real-world risk, cheap to fix). See `apps_script_v2.2.2.gs`.
- **Apps Script `setToken()` hardened** — now refuses to overwrite an already-set `ACCESS_TOKEN` unless called explicitly as `setToken(true)`; previously a stray re-run of this "run once, delete" helper could silently reset the token and lock out every coach.
- **Legacy localStorage keys (`coach_COUNTY_QT`/`coach_REGIONAL_QT`) completed their migration** instead of being read as a permanent fallback forever (Open Issue #2, pre-v2.6) — on load, if only the legacy key has data, it's written into the new `{meta,times}` key and the legacy key is removed.

### Accessibility
- **Viewport meta disabled pinch-zoom** (`maximum-scale=1.0, user-scalable=0`) — a WCAG 1.4.4 failure. Removed.
- **Mouse-only "clickable div" pattern** (swimmer-card headers, stat cards, Overview chart legend items) had no keyboard/screen-reader support. Added `role="button"`, `tabindex="0"`, `aria-pressed`/`aria-expanded` as appropriate, and a shared `kbActivate()` handler (Enter/Space triggers the existing `onclick`). Added a visible `:focus-visible` ring.
- **Modals had no dialog semantics, no focus management.** Added `role="dialog"`/`aria-modal="true"`/`aria-labelledby` to all four; added `openModalA11y()`/`closeModalA11y()` (remembers and restores focus) and `trapModalTab()` (keeps Tab/Shift+Tab within the open modal) wired into the existing Escape-key listener.
- **FAB buttons relied on `title` only** — added matching `aria-label`s, plus `aria-expanded` on the parent button kept in sync with open/closed state.

### Data-quality / UX
- User-facing localStorage size warning added (`checkLocalStorageSize()` was console-only) — a one-time-per-session alert when usage crosses ~4MB, pointing at Manage Data.
- Overview tab's day-cutoff and margin% inputs are now persisted as coach preferences across reloads (`coach_HOT_CUTOFF_DAYS`/`coach_BUBBLE_MARGIN`) — the rest of the Overview session state (expand/collapse, chart toggles, show-all/fewer) remains intentionally session-only, unchanged.
- GitHub QT sync now retries transient failures (network error, 5xx) with a short backoff (`fetchWithRetry()`) instead of failing on the first hiccup; a genuine 4xx (wrong/renamed file) still fails immediately since retrying wouldn't help.
- Name-search filter (County/Regional) now debounces its re-render (150ms) instead of re-rendering the full tab on every keystroke.
- Sanitisation results (records skipped, dates dropped, values coerced) are now surfaced in the relevant success/status message instead of only logging to the console.
- `pb.competition` — collected since early Overview work but never actually displayed — now shows as a tooltip on Hot Right Now entries.
- `r.event`/`r.course` in the County/Regional swimmer table, and `e.course` in the Bubble List, now escaped for defense-in-depth consistency (both were already safe-by-construction, unlike the Hot Right Now case above, but were inconsistent with the rest of the file's escaping discipline).
