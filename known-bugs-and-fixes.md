# Coach Dashboard — Known Bugs & Fixes (v2.9)

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script Web App as `${syncUrl}?token=${token}`. Risks the token landing in browser history and server/proxy access logs. Correct fix is a `doPost` handler reading the token from the JSON request body — requires a coordinated change to `apps_script_v2.2.2.gs`. **Still not fixed.** Explicitly reviewed again during the v2.6 security pass and deliberately left for a future session — it's a real, if low-urgency, fix and deserves its own focused turn rather than being squeezed in alongside everything else. Unchanged in v2.7 and v2.8 (both mobile-fixes/single-feature sessions, not touching sync transport).

### 2. Single shared sync token, not per-coach
One `ACCESS_TOKEN` in Apps Script Script Properties, shared by every coach. Documented accurately in the Settings modal. No way to revoke one coach's access without changing the token for everyone. **Deliberately not addressed** — real per-coach auth needs an Apps Script schema change (issuing/tracking/revoking individual tokens, a coach-identity concept) that's a genuine feature, not a fix; flagged during the v2.6 review and intentionally left as the documented, accepted trade-off it already was.

### 3. Apps Script quota
Apps Script has a daily execution quota (~20,000 calls on personal accounts). No rate limiting implemented. Low risk for single-coach use. Unchanged.

### 4. GitHub QT sync has no *offline* handling
v2.6 added retry-with-backoff for transient failures (`fetchWithRetry()`), which covers the common case (a dropped connection, a momentary GitHub 5xx). What's still missing: no queued/deferred retry if the coach is genuinely offline for longer than the retry window, and no visual "you're offline" state distinct from a generic error. Not relevant to v2.8's Backup & Restore, which is a local file operation with no network dependency.

### 5. Manual-upload/sync validation still isn't exhaustive
v2.6 closed the major gaps (swimmer `dob`/`gender`/PB `time`/`event`/`course`/`date`, and QT `gender`/`course`/`event`/`age`/`qualify`/`consider`) on both the manual-upload AND sync/GitHub paths, and — as of v2.8 — the Backup Restore path reuses those same checks; as of v2.9, `se` is validated the same way (see "Added in v2.9" below). Not yet validated: swimmer `id` (still not regenerated/checked — not a security issue post-v2.4's escaping fixes, just a data-quality gap), `squad` value (an unrecognised string is just displayed as-is rather than normalised), and QT `age` bracket strings aren't checked against the actual set County/Regional use (`10+11`…`17+` / `11/12`…`18+`) — just checked for being a non-empty string.

### 6. (New context, no code change yet) SE PB report import — matching/conflict/history design is planned, not built
A separate planning conversation produced a detailed, coach-approved plan for importing official Swim England PB reports (`.xlsx`, SC + LC) to validate/supplement gala-synced PBs, plus PB progression/history tracking on top of it. **Nothing here is a bug** — it's flagged here only so a future session doesn't start this work without first reading `se-pb-import-and-history-plan.md`, which has real constraints already worked out (e.g. this import must never be treated as an authoritative full-roster snapshot, for the same structural reason a real v2.2.1 regression happened before `sourceIsAuthoritative` existed). Queued as ~~v2.9 (SE# field)~~ **shipped** → v2.10 (`pbs` schema widening + `mergePbEntry()`) → v2.11 (the import itself). v2.8 (Backup & Restore) and v2.9 (SE#) were both sequenced deliberately ahead of the SE import itself — see "Added in v2.8"/"Added in v2.9" below.

### 7. `test_overview.js` — stale test fixture, NOT an app bug (root-caused after initial mischaracterisation)
Originally logged after v2.9's regression run as "two pre-existing failures, cause unknown." **Root-caused since**: the failing test (`sw_bubble_hidden_test`, Section 7 of `test_overview.js`) hardcodes a synthetic swimmer's `dob` and PB `time` assuming that combination produces a "Consideration/Outside" (near-miss) status forever. But age-bracket calculation is relative to *today's* date (`getCountyAgeBracket`/`getSeasonYear`), and enough real time has passed since this test was written that the swimmer now computes into a different age bracket where the hardcoded time is actually **faster** than the qualifying time — i.e. the synthetic swimmer has "aged into" already-qualified status. `buildBubbleList()` correctly excludes qualified swimmers (it only ever surfaces Consideration/Outside near-misses, by design), so the test's "toggle on → should appear" assertion now fails — not because the toggle or `buildBubbleList()` is broken, but because the fixture swimmer it's checking for is no longer eligible to appear under the toggle *at all*, independent of hidden/shown status. **Verified directly**: re-running the identical scenario with a genuinely non-qualified time (1% slower than the real, current qualifying time for that bracket, looked up dynamically rather than assumed) reproduces the intended behaviour exactly — toggle off excludes the swimmer, toggle on includes them and tags them with the correct `hideReason`. **The actual feature (`buildBubbleList()`'s hidden-swimmer inclusion path) has no bug** — this was purely a stale hardcoded fixture, the exact brittleness pattern a comment on a *different*, later test in the same file already warns about ("Don't hardcode an assumed age bracket/QT value — that's what broke last time, as 'today' advances") — that fix (computing brackets/near-miss times dynamically via `getCountyAgeBracket()`/`lookupQT()` rather than hardcoding) was applied to that later test but never backported to this earlier one. **Fix needed is test-only**: rewrite `sw_bubble_hidden_test`'s fixture the same dynamic way Section 12's tie-break test already does. Low priority — no coach-facing risk — but worth cleaning up alongside v2.10 since that session already needs a `test_overview.js` pass.

### 8. (Operational gotcha, not a code bug) Redeploying Apps Script as a NEW deployment silently breaks sync, because it gives a NEW `/exec` URL
Found post-v2.9, while the coach was rolling out `apps_script_v2.2.3.gs`. Symptom looked exactly like a code bug: SE # values were confirmed present in the Sheet, a new deployment was confirmed created, `index.html` was confirmed up to date — and the SE # still didn't come through on sync. Root cause: **Deploy → New deployment** mints a brand-new Web App URL distinct from any previous one, whereas editing the *existing* deployment (pencil icon → New version, under **Deploy → Manage deployments**) keeps the same URL. The dashboard's ⚙️ Settings modal still had the *old* URL saved, so every resync kept hitting the stale, un-updated deployment no matter how many times the underlying script was edited and redeployed — the new code was real, it just wasn't the code actually being served at the URL the dashboard was calling. **Not a dashboard defect** — this is standard Apps Script deployment behaviour, and the dashboard has no way to detect it from its side (a 200 OK with a plausible-shaped JSON body from the *old* deployment looks completely healthy). Fixed operationally by updating the URL in ⚙️ Settings to match the current deployment's URL (visible under **Deploy → Manage deployments**).

**Worth remembering for v2.10/v2.11**, both of which touch `apps_script_v2.2.3.gs` again: after redeploying, always double-check that ⚙️ Settings' saved URL matches the *current* deployment's `/exec` URL shown under **Manage deployments** — especially if "New deployment" was used at any point instead of "New version" on the existing one. A one-line reminder to this effect in the coach-facing Settings modal copy (`"Stored in your browser only..."` paragraph) might be worth adding in a future UI-focused session, since this is exactly the kind of trap a non-developer coach has no way to know about on their own.

### 9. (Feature request, explicitly deferred to v2.12) A dedicated "Swimmers" tab for basic profile data, independent of PB/QT status
Surfaced during the coach's manual UAT pass for v2.9 (see item 1.1's follow-up above): a swimmer with no PBs recorded yet doesn't appear on the County or Regional tabs at all unless "Show events without PB" is explicitly checked — since `renderTab()` excludes any swimmer who produces zero rows from `buildSwimmerRows()`, and a swimmer with an empty `pbs` array does exactly that against every event. This makes finding a just-added, PB-less swimmer again (to edit their basic data, or add their first PB once they've actually swum something) an unnecessarily indirect "journey" — check a box on a tab whose entire premise is QT comparison, not roster management. **Explicitly out of scope for v2.9** — the coach asked for this to be queued as its own future session, **v2.12**, not folded into this one. The right shape (a tab listing every swimmer's basic profile fields — name, DOB, gender, squad, SE#, PB count — independent of any QT/PB filtering) needs its own design pass rather than a quick patch onto County/Regional's existing exclusion logic.

---

## Added in v2.9

Scope, held exactly to what the session brief specified: the SE# field end-to-end, per `se-pb-import-and-history-plan.md` Section 5. Plus two unrelated mobile bugs, reported and fixed in the same session (see below) — not originally in scope, but small, self-contained, and requested directly.

### Feature: SE # field, end-to-end

- **`apps_script_v2.2.3.gs`** reads a new "Basic Data" column E, header `"SE #"`, via a newly-extracted `parseBasicDataRow(row, ss)` — pulled out specifically so this logic is unit-testable outside Apps Script (see `test_se_field.js`). Includes an optional `se` string on each swimmer in the sync payload when present; omitted entirely (not an empty string) when blank, matching how `squad` is already handled. Payload `version` bumped `"2.2"` → `"2.3"`.
- **`mergeSwimmers()`** carries `se` through from an authoritative sync at the same trust tier as `name`/`dob`/`gender`. **Soft-warning conflict handling** (not a silent overwrite, not a block): if a swimmer already has an `se` and the incoming sync value is *different*, the Sheet's value still wins (it's still authoritative), but the change is counted (`stats.seConflicts`) and named (`stats.seConflictNames`), surfaced in `startSync()`'s success message so a coach can double-check the Sheet if it looks wrong — this is exactly the kind of thing that signals a typo or an earlier SE-import fallback-match error, per the plan doc's reasoning.
- **`sanitiseSwimmersData()`** validates `se` as `/^\d+$/` when present — invalid values are **dropped, not fatal**: just the `se` field is removed, the swimmer record itself is kept (same treatment as an invalid PB `date`). Returns a new `seDropped` count, surfaced via `describeSanitiseIssues()` on every path that already calls it (manual upload, sync, restore) with zero changes needed to those call sites beyond destructuring the new field.
- **Add/Edit Swimmer** gained an optional SE # input, its own row directly below Gender/Squad (not squeezed into an existing grid) — validated client-side the same way (`/^\d+$/`, blank allowed), with a clear inline error rather than a silent no-op on an invalid value.

### Two mobile bugs found and fixed in the same session (not originally in scope)

Reported directly by the coach while testing this session's UI changes on a phone:

1. **Date of Birth / Date Set fields overflowing the Add/Edit Swimmer modal.** Root cause: `.form-grid-2` (Name+DOB) and `.pb-top-grid` (Event/Course/Time/Date Set) are 2-column CSS Grids, and a native `<input type="date">`'s intrinsic minimum content width — day/month/year segments plus the calendar-icon affordance — is wider than a 50% column can offer on a narrow phone. CSS Grid items default to `min-width: auto`, so that minimum forced the column (and the modal) wider than the viewport rather than letting the input shrink. **Fix, round 1:** both grids collapse to a single column under the existing mobile breakpoint.
2. **Every text field zooming the page in on focus, staying zoomed after tapping out.** iOS Safari zooms the whole viewport in when a focused form control's computed `font-size` is under 16px — a page-level zoom with nothing to reset it on blur, hence "stays zoomed until manually pinched back out." Every text input/select in the dashboard was well under 16px at its normal desktop-tuned size (`0.76rem`–`0.83rem`), triggering it on every field, everywhere. **Fix:** a single mobile-only rule raises `.form-input`, `.name-search`, `.qt-inline-input`, `.margin-input-group input`, and bare `select` to `font-size: 16px`; `.margin-input-group input` was also widened slightly (64px→72px) to keep a 3-digit value comfortable at the larger size. Scoped entirely inside the mobile breakpoint — desktop type is untouched.

**Round 1's Date of Birth/Date Set fix turned out to be insufficient**, per the coach's manual test script (see "Fixes made after the coach's UAT pass" below) — the date input was still rendering visibly wider and taller than its siblings even in a single column. That got a second, deeper fix — see below.

### Fixes made after the coach's manual UAT pass (same session, before sign-off)

The coach ran the full manual test script (`user_test_script_v2.9.md`) end-to-end and reported real issues on 4 items. All four were fixed in this same session, still v2.9:

1. **Date of Birth / Date Set still overflowing on mobile, round 2.** Round 1's single-column grid fix was real and necessary but not the whole story: a native date input's day/month/year segments and calendar icon are rendered by the browser's own UA styling, which several mobile browsers only partially constrain via author `width`/`box-sizing` rules, and which several mobile browsers also render at a taller minimum control height than a plain text input at the same font-size — both are quirks of the native control itself, independent of the surrounding grid. **Fix:** `input[type="date"].form-input` (a selector specific enough to win out over the browser's own date-input styling) gets explicit `width: 100%; max-width: 100%; min-width: 0; height: 40px; box-sizing: border-box;`, plus the internal WebKit/Blink date sub-elements' own padding is reset (`::-webkit-datetime-edit`, `::-webkit-calendar-picker-indicator`). Every other field on the same rows (`.form-input`, `.name-search`, `.margin-input-group input`, `select`) also got the same explicit `40px` height, so the date input isn't the odd one out in either direction — everything lands on one consistent height. **Could not be visually verified in this environment** (no real rendering engine available to check) — confirmed only that the correct CSS rules are present via source-text checks; the coach's own re-test on a real device is the real confirmation this is actually fixed.
2. **Add/Edit Swimmer forcing an empty PB row by default.** Both `showAddSwimmerModal()` and `editSwimmer()` (for a swimmer with zero existing PBs) auto-added one blank PB row, which `saveSwimmer()`'s per-row validation then required a time for — so adding or editing a swimmer's *basic* data only (name/DOB/squad/SE#, no PB yet) meant deleting that unwanted row first before Save would let the coach through. Made worse by the fact that a swimmer with genuinely zero PBs doesn't show up on the County/Regional tabs at all unless "Show events without PB" is checked, so finding them again to fix it was its own small journey. **Fix:** neither function auto-adds a row anymore; both leave the PB list empty by default, with "＋ Add PB entry" still available for anyone who wants one. **Noted, explicitly deferred to v2.12, not this session:** the coach also flagged that a dedicated "Swimmers" tab (all basic swimmer data, independent of PB/QT status) would remove the underlying discoverability problem entirely — tracked for that future session, not addressed here.
3. **Sync modal's auto-close firing before a warning could be read.** The modal previously auto-closed 3 seconds after *any* successful sync, regardless of message length — nowhere near enough time to read a message naming specific swimmers in an SE # conflict, especially with several. **Fix:** `startSync()` now computes `hasNotableWarning` (true if the message includes a QT-data-missing note, a sanitiser-drop note, or an SE # conflict note) and only arms the 3-second auto-close timer when it's false — a message with something to review now stays open until the coach closes it manually.
4. **`mergeSwimmers()`'s "updated" count including swimmers nothing happened to, and the conflict dialog appearing off-screen.** Two separate issues surfaced from the same test step: (a) every swimmer matched by name+DOB during a sync or merge upload was counted as "updated," even when nothing about them changed — so a full-roster re-upload/re-sync with a single genuine edit reported something like "67 updated," making the real change indistinguishable from noise. **Fix:** `mergeSwimmers()` now compares the fields that matter (`name`/`dob`/`gender`/`squad`/`se`/`pbs`) before vs. after merging and only counts a swimmer as `updated` if something genuinely differs; an unchanged matched swimmer is tallied separately as `matched`, surfaced as "N unchanged" in both `applySwimmersUpload()`'s and `startSync()`'s status messages when nonzero. **Confirmed, not a bug, while fixing this:** a non-authoritative merge upload never touches `se` regardless of what the uploaded file contains — only an authoritative Sheet sync can change it, by design; editing SE # in a downloaded-then-reuploaded `swimmers_pb.json` file is a no-op, exactly as observed. (b) The conflict dialog (Replace/Merge/Cancel) lives near the bottom of the Manage Data modal, below all three per-source cards; clicking a source's Upload button (which sits mid-card, not at the bottom) while scrolled elsewhere produced no visible change from where the coach was looking. **Fix:** `showDataConflict()` now calls `scrollIntoView()` on the conflict box the moment it's shown.

### A second UAT round, same session: a follow-up close-button request, a merge-wording question, and three more polish items

After the fixes above, the coach re-tested and raised five more points — three fixed, one confirmed-as-designed, one queued for v2.12:

1. **"Without auto-close it's not clear how to leave the Sync modal when there's a real warning."** Fair — disabling auto-close (the round-1 fix above) solved "the warning vanishes before I can read it" but left only a small top-right ✕ and a "Cancel" button that reads oddly once a sync has already completed. **Fix:** a dedicated, full-width **"✅ Got it - Close"** button now appears specifically (and only) when `hasNotableWarning` is true — Cancel/Sync Now stay available too, for a coach who wants to sync again rather than just leave.
2. **"Is it right that manual upload doesn't distinguish local-only swimmers the way sync does?"** Investigated and confirmed: yes, and it's working as designed, not a bug. A manual-upload merge (`sourceIsAuthoritative: false`) never applies a keep/hide/remove *choice* the way sync does (there's no such option in that flow at all) — it's unconditionally "keep whatever's not in the file." The coach's two different counts (3 local kept on sync vs. 0 on a manual merge) were both correct for their respective scenarios: the manual re-upload happened to be a full-roster snapshot containing literally everyone, so there was nothing "not in the file" to report. The confusing part was purely **wording** — "local kept" implied an active choice that manual-upload-merge doesn't actually have. **Fix:** that message now reads "N not in this file (left as-is)" instead, and is only shown when nonzero; sync's own "local kept" wording is untouched, since it does reflect a real coach-selected mode there.
3. **Add/Edit Swimmer's Save button required scrolling to the bottom of a long PB list.** **Fix:** the Cancel/Save row (plus the validation error box, which had the same problem) is now sticky to the bottom of the modal's own scroll area on every viewport — same "bleed to the modal's own edge" technique already used for the Manage Data modal's mobile-only status dock, applied here for all screen sizes since a long PB list is just as much a desktop issue.
4. **Long dashes ("—") throughout warnings and guidance text, replaced with a plain hyphen ("-").** Applied across all genuinely user-facing strings — status/success/error messages, tooltips, labels, placeholders, the page title — while deliberately leaving two categories untouched: developer-facing code comments (not something a coach ever sees), and the handful of places "—" is used as a standalone placeholder glyph for a missing value in a table cell (e.g. `secToTime()`/`fmtDate()` returning `'—'` for "nothing recorded") — that's a different, intentional design element, not a run-on sentence connector, so it was left as-is pending confirmation it should change too.
5. **"Sheet" standardised to "Google Sheet" everywhere in user-facing text**, for consistency (the modal titles/buttons already mostly said this correctly; a handful of labels, tooltips, and status/warning strings still said the bare "Sheet").

**Explicitly deferred to a new v2.12, not this session:** a dedicated "Swimmers" tab for basic profile data (name/DOB/gender/squad/SE#/PB count), independent of County/Regional's PB/QT-driven filtering — raised during the same UAT round as the reason a PB-less swimmer is hard to find and edit today. See Open Issue #9 below.

### Testing

- `test_se_field.js` — unchanged this round, still a plain Node test (15 checks, all passed) against `apps_script_v2.2.3.gs`'s `parseBasicDataRow()`/`formatSE()`.
- `probe_se_field.js` — extended twice after coach UAT feedback; now 45 checks, all passed. Covers the original SE#/CSS work plus: the empty-PB-list-by-default fix; the round-2 date-input CSS; `hasNotableWarning` gating; `mergeSwimmers()`'s `matched`-vs-`updated` distinction; `showDataConflict()`'s scroll-into-view; the sticky `.as-action-row`; the dedicated sync `syncCloseBtn`; the reworded manual-merge message; and the "Google Sheet" wording fix.
- Full `test_overview.js` run (re-confirmed after this round of fixes too): the same 2 pre-existing failures as before (see Open Issue #7) — every other check passed, and nothing new failed as a result of this round's changes. `node --check` clean on the extracted script throughout.

---

## Added in v2.8

Not a bug-fix session — a single, planned feature, built exactly to the spec locked in `se-pb-import-and-history-plan.md` Section 6. Included here (rather than only in `session-log.md`) because it introduces new data-entry surface area (a fourth way data can enter/replace the app's state) worth tracking alongside the rest of the validation/security history above.

### Feature: Full Backup & Restore

A new "🗄️ Full Backup & Restore" card in the Manage Data modal, additive to the three existing per-source cards (Swimmers, County QT, Regional QT):

- **Download** (`downloadBackupBundle()`) bundles all three datasets — `{version, generated, swimmers, countyQt: {meta, times}, regionalQt: {meta, times}}` — into a single JSON file, `coach_dashboard_backup_YYYY-MM-DD.json`. Deliberately **excludes `coach_SYNC_URL`/`coach_SYNC_TOKEN`** — verified with a jsdom probe asserting neither value appears anywhere in the serialized bundle.
- **Restore** (`loadBackupFile()` → `applyBackupRestore()`) reads the file, validates it has at least one of the three recognisable pieces (rejecting outright with no confirmation shown if it has none), pre-sanitises whichever pieces are present through the **existing** `sanitiseSwimmersData()`/`sanitiseQTData()` — no new sanitiser was written — and only then shows a `confirm()` naming the exact current-count → restored-count for every dataset, explicitly stating "not included in this backup — left as-is" for anything the bundle doesn't have. On confirmation, replaces only the pieces that were present (Replace-only, per-dataset, not all-or-nothing), persists via the standard `lsSet()`/`saveQTToStorage()` write-checked pattern, and re-renders.

### Decisions made during scoping (for future reference)

- **Partial-bundle handling — replace only what's present, leave the rest untouched, rather than rejecting the whole restore.** The app's three data sources are already independent elsewhere (each has its own sync/upload/download/clear); a bundle missing one piece (predates a source being loaded, or was deliberately exported after clearing something) shouldn't be treated as invalid. The confirmation dialog makes any gap explicit before anything happens, so there's no silent surprise.
- **`confirm()` rather than the inline `dataConflictBox` UI.** The conflict box is built around a Replace/Merge *choice*; Restore only ever has one path (Replace-per-present-piece), so introducing a second UI paradigm for a single-path action wasn't warranted. Matches the existing `clearData()` pattern for irreversible bulk actions.
- **Same card, stacked rows (Download on top, file input + Restore below)** rather than two separate cards — mirrors how every existing per-source card already combines a primary action with an upload row beneath it, and keeps the two directions of the same bundle visually paired rather than looking like unrelated features.
- **No new sanitiser was written.** The bundle is just JSON containing the same three shapes every other upload/sync path already validates, so `sanitiseSwimmersData()` and `sanitiseQTData()` were reused directly — this also means any future change to those two functions (e.g. v2.10's `pbs`-schema widening) automatically applies to Restore with zero additional work.

### DOM-order care (given the recent v2.7 history in this exact modal)

The new card was inserted between the Regional QT card and the "Clear All Data / Close" button row — i.e. still fully **before** `#dataModalStatusDock`. This was the exact bug class v2.7 fixed (a new/reordered element in this modal accidentally ending up after the dock, breaking its sticky-bottom mobile behaviour), so it was verified explicitly with a jsdom probe asserting `modalBox.lastElementChild === statusDock` and that the button row precedes the dock in document order — the same two assertions v2.7's probe used, now re-run with the new card present.

### Testing

Verified with a dedicated jsdom probe, `probe_backup_restore.js` (not added to the permanent `test_overview.js` suite, following the v2.7 `probe_fixes.js` precedent of a targeted probe for a targeted change) — 32 checks: additive card presence alongside the three existing cards, the DOM-order property above, correct bundle shape and credential exclusion on download, full-restore replacement + persistence + status messaging, partial-bundle "leave untouched" behaviour for the missing piece while still replacing the present ones, and outright rejection (no `confirm()` shown) of a file with none of the three recognisable pieces. All 32 passed. `node --check` clean on the extracted script.

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
- **Mobile Age-composition legend digit truncation.** Some 2-digit ages (12, 13, 14, 15) rendered as a bare "1" with no ellipsis; others (16, 17, 18, 19) rendered correctly. Root cause: `.ov-legend-label { min-width: 0 }` let a long *adjacent* count string (e.g. "15 (18%)") squeeze that row's label down to sub-one-character width before any ellipsis had room to render. **Fix:** `min-width: 2.4ch`.

### Design iteration
Hot Right Now / Bubble List entry rows went through several rounds based on direct feedback (flat row → CSS grid → two-line "time as hero stat" → grouped result block → stroke accent bar). A leading `+` sign on the Bubble List's time-difference stat was removed as ambiguous.

### Test-suite bugs (in `test_overview.js`, not the shipped dashboard)
A "default margin is 5%" assertion that ran after a mutation; a tie-break test whose fixture didn't actually tie. Both fixed.

---

## Fixed in v2.6

This was a two-part session: two direct mobile bug reports (gender/squad badge height mismatch, and Bubble List event text wrapping on narrow phones), followed by a full deliberate codebase review (security, bugs, UI/accessibility, code quality) producing a 20-item list, all of which were rolled out — plus two additional issues found *while implementing* those 20 that weren't on the original list. One more mobile UX fix (Manage Data status visibility) was done in a follow-up turn. See `session-log.md` for the full turn-by-turn narrative; this section groups the same work by outcome.

### Real production bugs found and fixed
- **Mobile gender-pill / squad-badge height mismatch.** `.gender-pill-mobile` used a relative `line-height: 1.6` while `.squad-badge` used the browser default; combined with their different `font-size`s, the two pills could never render at the same height no matter how padding was tuned. **Fix:** both now share a fixed `line-height: 15px` and `padding: 2px 8px`, so box height is identical regardless of font-size. **Note (v2.7): this fix was insufficient — see "Fixed in v2.7" below for what actually closed the gap.**
- **Bubble List / Hot Right Now event text wrapping on narrow phones.** Root cause wasn't "font too big" — `.ov-entry-stat-meta .badge` (two-class selector) was more specific than the generic mobile `.badge` rule, so the SC/LC course badge inside these entries **never actually shrank on mobile at all**, staying at full desktop size next to already-abbreviated event text. **Fix:** added a matching-specificity mobile override; also tightened `.ov-entry-stat-meta`'s own font-size/gap. Fixes both sections at once since they share the class.
- **Real stored-XSS vulnerability, found while fixing a defense-in-depth item.** Hot Right Now's `collectRecentPbs()` reads `sw.pbs` directly, bypassing the `ALL_EVENTS`/`'S'|'L'`-constrained lookup path that County/Regional/Bubble List all use — and rendered `pb.course` **completely unescaped** in a `class="badge ${e.course}"` attribute, with no validation of `pb.event`/`pb.course` anywhere in `sanitiseSwimmersData()` at the time. A manually-uploaded (or compromised-Sheet) PB with a crafted `course` string could break out of that attribute. **Fixed at the root** (sanitiser now validates `pb.event` against `ALL_EVENTS` and `pb.course` against `'S'`/`'L'`, dropping the PB if either is invalid) **and at render time** (both occurrences of `e.course` now escaped, as defense-in-depth). Verified with a dedicated XSS probe (payload rejected by the sanitiser; when injected directly bypassing the sanitiser, renders as inert escaped text with no `<img>` element created and no script execution).
- **`.tbl-wrap` (QT Editor's table wrapper) had no matching CSS rule at all** — the class was used in `renderQTEditor()`'s markup but nothing defined it, so the table had no horizontal-scroll containment on narrow desktop windows. Added the missing `overflow-x: auto`, mirroring `.swimmer-table-wrap`.
- **Manage Data modal warnings hidden below the fold on mobile.** Status/error/conflict messages sat in normal document flow below three data-cards; on a short mobile viewport, an upload-triggered merge conflict or sync error could go completely unnoticed unless the coach scrolled down afterward. **Fix:** wrapped the three elements in a dock that becomes `position: sticky` at the bottom of the modal's scroll area (mobile only) the moment any of them has something to show, and disappears (no empty floating bar) otherwise. Desktop unchanged. **Note (v2.7): this dock CSS fix was correct, but a DOM-order issue in the surrounding markup let the dock overlap OTHER content anyway — see "Fixed in v2.7" below.**

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

---

## Fixed in v2.7

A short, two-bug follow-up session. Both bugs were reported directly with screenshots; both turned out to need a different fix than the v2.6 attempt at the same symptom (bug 1) or a fix in a different layer than the one already shipped (bug 2).

### Real production bugs found and fixed

- **Gender pill still taller than the squad badge, despite the v2.6 fix.** The v2.6 fix (shared `line-height: 15px` on both pills) addressed the wrong layer: `line-height` constrains the line *box*, not the glyph's own rendered ink, and the ♀/♂ characters can still visually overflow a "correctly sized" line box on some mobile rendering paths. **Root-caused properly this time with two independent fixes:**
  1. Both `.squad-badge` and `.gender-pill-mobile` now use an explicit fixed `height: 19px` with `display: inline-flex; align-items: center; justify-content: center`, replacing the line-height-based approach — box height can no longer drift regardless of glyph metrics. The mobile display-toggle also changed from `inline-block` to `inline-flex` (the only place the pill actually renders), since `inline-block` would have silently dropped the new centering behaviour on mobile specifically.
  2. The ♂/♀ HTML entities now carry the Unicode text-presentation variation selector (U+FE0E) immediately after them (`&#9794;&#xFE0E;` / `&#9792;&#xFE0E;`), explicitly requesting the plain monochrome text glyph rather than any colour/emoji presentation a platform might otherwise substitute for these characters.

  Verified with a jsdom probe reading `getComputedStyle` on both classes directly (confirmed identical `19px` height, matching flex-centering properties on both) and a source-string check for the U+FE0E selector's actual presence in the render path.

- **Manage Data modal's status message overlapping the Close / Clear All Data buttons on mobile.** The v2.6 fix for status-visibility (a sticky bottom dock, `margin-bottom: -20px` to bleed flush with the modal edge) implicitly assumed the dock was the last element in the modal. It wasn't — the Clear All Data / Close button row sat after it in the markup, so the negative margin pulled that row up underneath the dock's own painted area, visually burying part of both buttons under the status message. **Fix:** reordered the modal's markup so the button row comes before the status dock, making the dock the genuine last child of the modal box. Purely a DOM-order change — no CSS touched, since the sticky-bottom CSS itself was already correct once there was nothing left below it to cover.

  Verified with a jsdom probe asserting `modalBox.lastElementChild === statusDock` and that the button row precedes the dock in document order (`compareDocumentPosition`). **This exact assertion was re-run in v2.8** when a fourth card was added to the same modal, to make sure the same class of bug wasn't reintroduced — see "Added in v2.8" above.

### Process note for future sessions
Both v2.7 fixes replaced a v2.6 fix that looked complete (correct-seeming CSS, tests passed at the time) but didn't actually close the reported gap, because the earlier fix addressed a plausible-but-wrong layer of the problem. Worth remembering when a bug report describes a symptom that was supposedly already fixed: re-derive the root cause from the actual current code rather than assuming the previous fix's diagnosis was correct and just needs reinforcing.
