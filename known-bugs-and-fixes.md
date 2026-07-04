# Coach Dashboard — Known Bugs & Fixes (v2.4)

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script Web App as `${syncUrl}?token=${token}`. This risks the token landing in browser history and any server/proxy access logs that record full request URLs — a well-known anti-pattern (avoid sensitive data in GET query strings). The correct fix is a `doPost` handler reading the token from the JSON request body instead of `e.parameter.token`, which requires a coordinated change to `apps_script_v2.2.1.gs`. Not fixed in v2.4: that file wasn't available to inspect/modify this session, and changing only the client would break a currently-working sync without the ability to test against the real endpoint. Scope a dedicated session for this with the `.gs` file in hand.

### 2. Old localStorage keys
`coach_COUNTY_QT` and `coach_REGIONAL_QT` (plain-array format) are still read as fallbacks in `parseQTFull()`. Never written in v2+. Can be removed from the fallback chain once all devices have migrated (i.e. loaded and re-saved at least once under `_FULL` keys).

### 3. localStorage size limit
Browser localStorage typically limited to 5–10 MB. `checkLocalStorageSize()` logs console warning above 4 MB. No user-facing warning exists. Low risk for current squad size (~85 swimmers as of v2.4).

### 4. Apps Script quota
Apps Script has a daily execution quota (~20,000 calls on personal accounts). No rate limiting implemented. Low risk for single-coach use.

### 5. Single shared sync token, not per-coach
There is one `ACCESS_TOKEN` in Apps Script Script Properties, shared by every coach. Documented accurately in the Settings modal (see v2.3 fixes) but remains a real limitation — no way to revoke one coach's access without changing the token for everyone. Would require a token→coach map in Script Properties plus corresponding Apps Script changes — not implemented.

### 6. GitHub QT sync has no offline/error retry
`syncQTFromGitHub()` reports a clear error on fetch failure but doesn't retry or queue. Consistent with the Sheets sync error handling, so not considered a bug.

### 7. Manual-upload validation doesn't cover every field
`sanitiseSwimmersData()` validates `name`, `dob`, `gender`, and PB `time` on manual swimmer file uploads, but not `id` — a gap that was directly responsible for one of the v2.4 XSS fixes (see below). The rendering-side fix (`escAttr()` now HTML-entity-escapes) closes the actual vulnerability regardless of what `id` contains, but the upload validator still doesn't reject or regenerate a malformed/unexpected `id`. Similarly, `applyQTUpload()` performs no validation at all on `gender`/`course`/`event`/`age`/`qualify`/`consider` from an uploaded QT file — again, the rendering-side fix closes the injection risk, but a QT file with an `event` string that doesn't match `ALL_EVENTS`, or non-numeric `qualify`/`consider`, will silently produce rows that never match any swimmer lookup rather than being rejected with a clear error at upload time. Low priority — not a security issue post-v2.4, just a data-quality/UX gap.

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

- `squad-former-swimmer` CSS class never matched `.squad-former` selector — `replace(' ','-')` → `replace(/\s+/g,'-')`
- `esc`/`esc2` inconsistency — unified into module-level `escAttr()`
- Duplicate comment in `renderQTEditor`
- `pb.time`, `initials(sw.name)`, stat card `nameList`, `sw.id` all unescaped in `innerHTML` or `onclick` — all wrapped with `escHtml()`/`escAttr()`
- No DOB/time validation on file load — sanitisation added in `loadDataFiles` (later renamed/split in v2.3)
- Inconsistent `toFixed(3)` vs `toFixed(2)` — standardised to `toFixed(2)`
- Startup `JSON.parse` without try/catch — `lsGet()` helper added
- Footer note hardcoded "SE London Regional" — now reads from `REGIONAL_QT_META.title`

---

## Fixed in v2.2.1 (Gemini regression + security)

Four bugs introduced by a third-party edit to `startSync()`: wrong localStorage key, wrong variable casing, spurious `window.location.reload()` (`Object.keys(array)` on an array always returns truthy index strings), `mergeSwimmers()` defined but never called. Security: token moved from hardcoded source to `localStorage`/`PropertiesService`; `openById(SHEET_ID)` → `getActiveSpreadsheet()`; Apps Script deployment changed to "Anyone" (token is the auth gate; Google login redirect was blocking `fetch()` from localhost).

---

## Fixed in v2.3

Removed hardcoded championship date constants (age brackets/banner/footer now derive dates from QT metadata) · removed `loadSampleData()` and its fictional swimmers · removed a duplicate stale `#syncModal` block · removed a duplicate `fabShowSyncModal()` function · dead CSS/markup cleanup · standalone Sync FAB folded into the redesigned Manage Data modal · County/Regional GitHub QT sync added · Manage Data modal redesigned as one card per source with sync/upload/download/clear · conflict resolution (Replace/Merge) added for manual uploads over existing data · Clear Data (per-card + Clear All) added, wired into every related localStorage key · Download/Clear buttons disabled when their dataset is empty · cross-reference hints added (swimmers loaded but no QT data, or vice versa) · `refreshDataModalStatus()` now called after a successful Sheets sync (previously the Manage Data modal underneath the Sync modal showed a stale count) · `coach_SHEETS_LAST_SYNC` now cleared when swimmers are wiped, matching QT's own last-sync clearing · Settings modal copy corrected re: shared vs. per-coach token · `refreshDataModalStatus()` consolidated from three near-identical per-card blocks into shared helpers.

---

## Fixed in v2.4

### Data integrity
- **`mergeSwimmers()` silently dropped all Sheets-synced swimmers on a manual-upload merge.** The function assumed the incoming set is always a complete, authoritative source snapshot (true for a Sheets sync) — its local-only-retention step skipped anything tagged `source:'sheet'` on that assumption. Called from the manual-upload path with a partial file instead of a full snapshot, every existing sheet-tagged swimmer fell through every branch and was silently omitted — not "removed," not counted in stats, just gone. **Fix:** added `opts.sourceIsAuthoritative` to `mergeSwimmers()` — `true` for Sheets sync (unchanged behaviour), `false` for manual upload (existing swimmers absent from the uploaded file are now always kept regardless of `source`). Verified via isolated simulation of the exact reported scenario (62 sheet + 22 upload → 84 retained) and a genuine-Sheets-removal scenario (unchanged correct behaviour).

### Diagnostics — "why isn't this swimmer showing"
- **Swimmer cards vanished with zero explanation** whenever they produced no comparison rows under the current filters — indistinguishable whether the cause was a genuine "no PB recorded," a data-quality problem (malformed `dob`/unexpected `gender` — notably possible via Sheets sync, which skips the manual-upload validation path entirely), an active Status/Course/Stroke filter correctly excluding them, or a default gate (Former Swimmer, merge-`hidden`) active regardless of any filter. Built out incrementally across the session into a five-category diagnostic (`no-match` / `no-pbs` / `filtered` / `former` / `hidden`) surfaced via an expandable footer note on both County and Regional tabs, with severity-appropriate styling (only genuine data issues get the alarming gold/⚠️ treatment). See `session-log.md` Turns 3, 5, 8 for the incremental history — the first version incorrectly conflated "filtered" with "no-pbs," and initially missed Former Swimmers/merge-hidden swimmers entirely since those are excluded one step earlier in the render pipeline than where the diagnostic first looked.

### UI correctness
- **Sync modal's own "Last synced" timestamp never refreshed after Clear Data** — it's a separate DOM element from the Manage Data modal's inline timestamps, and was only ever populated once at page load. Now re-read from localStorage every time the modal opens.
- **Sync timestamps displayed in browser-locale format** (US `M/D/YYYY` for an en-US browser) — added `fmtDateTime()` for a fixed, locale-independent `DD/MM/YYYY, HH:MM` format.
- **Championship banner misstated multi-day events as single-day** — "took place on 15 Feb 2026" when that was only the last day of a 7–15 Feb event. Added `describeChampDates()` covering five distinct date-metadata shapes (range / genuine single-day / dateTo-only / dateFrom-only, each past and upcoming tense); fixed in both banner branches (the upcoming-tense branch had the identical bug, not previously reported).
- **Collapse All wasn't the default state** — added as a v2.4 feature request. Cards now default to collapsed on first load and every time a County/Regional tab is (re-)opened, even after being expanded earlier in the same session.

### Security — three stored-XSS vulnerabilities (found via a full codebase review, not user-reported)
All three confirmed exploitable with an actual jsdom proof-of-concept before the fix, and confirmed closed afterward — not inferred from reading the code alone.
1. **`escAttr()` only escaped the inner JS-string-literal layer, not the outer HTML-attribute layer.** Used for `onclick="fn('${escAttr(x)}')"` — a JS string nested inside an HTML attribute. It escaped backslash/single-quote (correct for the JS layer) but never double-quote (needed for the HTML layer). A crafted `id` from a manually-uploaded `swimmers_pb.json` (never validated — see Open Issue #7) broke out of the `onclick` attribute entirely and injected a real, browser-executed `onmouseover` handler. **Fix:** layered HTML-entity escaping (`&` `"` `<` `>`) on top of the existing JS-string escaping, in the correct order so entities from one layer aren't reinterpreted by the other.
2. **QT Editor rendered `gender`/`event` as raw, unescaped HTML text content** (a different injection class from #1 — this is direct markup injection, not attribute breakout, so `escAttr()` never applied here in the first place). A crafted `event` string in an uploaded QT file rendered as a real DOM element with an `onerror` handler. **Fix:** wrapped both in `escHtml()`.
3. **`sw.gender` rendered unescaped in the swimmer card meta line.** Lower risk in practice since manual uploads validate gender strictly to `"Boys"`/`"Girls"`, but Sheets-synced data bypasses that validation entirely, so it wasn't actually guaranteed safe. Fixed for consistency with how `sw.squad` was already handled (escaped since v2.1).

All three re-verified with a full regression pass on legitimate data (apostrophe in a name, ampersand in a competition title) — no double-encoding or display breakage introduced.
