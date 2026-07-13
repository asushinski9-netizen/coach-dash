# Coach Dashboard — Known Bugs & Fixes (v2.5)

---

## Open Issues

### 1. Sync token sent as a URL query parameter, not a header
`startSync()` calls the Apps Script Web App as `${syncUrl}?token=${token}`. Risks the token landing in browser history and server/proxy access logs. Correct fix is a `doPost` handler reading the token from the JSON request body — requires a coordinated change to `apps_script_v2.2.1.gs`. **Still not fixed** — the `.gs` file has been available since v2.5 started, but this session's work was entirely scoped to the new Overview tab; carry this forward explicitly for v2.6 if it's a priority.

### 2. Old localStorage keys
`coach_COUNTY_QT` and `coach_REGIONAL_QT` (plain-array format) are still read as fallbacks in `parseQTFull()`. Never written in v2+. Can be removed once all devices have migrated.

### 3. localStorage size limit
Browser localStorage typically limited to 5–10 MB. `checkLocalStorageSize()` logs a console warning above 4 MB. No user-facing warning exists.

### 4. Apps Script quota
Apps Script has a daily execution quota (~20,000 calls on personal accounts). No rate limiting implemented. Low risk for single-coach use.

### 5. Single shared sync token, not per-coach
One `ACCESS_TOKEN` in Apps Script Script Properties, shared by every coach. Documented accurately in the Settings modal. No way to revoke one coach's access without changing the token for everyone.

### 6. GitHub QT sync has no offline/error retry
Reports a clear error on fetch failure but doesn't retry or queue. Consistent with the Sheets sync error handling.

### 7. Manual-upload validation doesn't cover every field
`sanitiseSwimmersData()` validates `name`, `dob`, `gender`, and PB `time`, but not `id`. `applyQTUpload()` performs no validation at all on `gender`/`course`/`event`/`age`/`qualify`/`consider`. Not a security issue post-v2.4 (the rendering-side escaping closes the injection risk regardless), just a data-quality/UX gap.

### 8. Overview tab session-only state doesn't survive a reload
Chart-toggle exclusions, per-card expand/collapse, show-all/fewer, the Hot Right Now day cutoff, and the Bubble List margin % are all held in module-level JS state or DOM input values, not `localStorage`. A page reload silently resets them all to defaults. This is consistent with how `collapseAllState` already behaves on County/Regional (also session-only), so it's a deliberate pattern, not an oversight — flagging it here in case a future session decides some of these (e.g. the day cutoff / margin %) are worth persisting as a coach preference.

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
- **Mobile Age-composition legend digit truncation.** Some 2-digit ages (12, 13, 14, 15) rendered as a bare "1" with no ellipsis; others (16, 17, 18, 19) rendered correctly. Initial hypothesis (container/column width too narrow) was wrong — the multi-column legend container was already flexible (`flex: 1`). **Root cause:** `.ov-legend-label { min-width: 0 }` let a long *adjacent* count string (e.g. `"15 (18%)"`, 8 characters) squeeze that specific row's label down to sub-one-character width before any text-overflow ellipsis had room to render — while a shorter count on a neighbouring row (e.g. `"7 (8%)"`, 6 characters) left the label enough room to render fully. This exactly matched the observed pattern: truncation correlated with count-string length, not with the age being 2 digits per se. **Fix:** `min-width: 2.4ch`, guaranteeing at least 2 digits' worth of room regardless of the neighbouring count's length. Verified via `getComputedStyle` in the jsdom test suite.

### Design iteration (not "bugs" in the traditional sense, but real usability feedback acted on)
- Hot Right Now / Bubble List entry rows went through several rounds based on direct feedback: a flat one-line layout → a spreadsheet-style CSS grid (technically correct, visually flat) → a two-line "time as hero stat" layout whose first cut stretched time and date apart with `space-between`, which read as "scattered"/disconnected — fixed by grouping time and its date into one right-aligned block. A colored stroke-accent bar was added afterward specifically to help tie the two columns together, per explicit follow-up feedback that the layout still felt disconnected.
- A leading `+` sign on the Bubble List's time-difference stat was flagged as ambiguous (could read as "ahead" rather than "behind") and removed in favour of a plain "0.12s off" phrasing — every Bubble List entry is by definition still short of qualifying, so a sign was never actually adding information, only ambiguity.

### Test-suite bugs (in `test_overview.js`, not the shipped dashboard)
Two caught and fixed during this session's own verification work, worth recording since they're easy to reintroduce:
- A "default margin is 5%" assertion ran *after* an earlier test step had already changed the input's value to test widening/narrowing — reading a mutated value, not the true default. Fixed by moving the default-value check to before any mutation.
- A tie-break test (closest-gap swimmers, more-opportunities-wins) gave one synthetic swimmer's second entry a smaller gap than intended, so it passed via the primary sort (smallest gap) rather than the tie-break it was meant to isolate. Fixed by computing both synthetic near-miss times the same way so they genuinely tie.
