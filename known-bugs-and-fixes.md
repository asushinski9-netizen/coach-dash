# Coach Dashboard — Known Bugs & Fixes (v2.3)

---

## Open Issues

### 1. Old localStorage keys
`coach_COUNTY_QT` and `coach_REGIONAL_QT` (plain-array format) are still read as fallbacks in `parseQTFull()`. Never written in v2+. Can be removed from the fallback chain once all devices have migrated (i.e. loaded and re-saved at least once under `_FULL` keys).

### 2. localStorage size limit
Browser localStorage typically limited to 5–10 MB. `checkLocalStorageSize()` logs console warning above 4 MB. No user-facing warning exists. Low risk for current squad size (~60 swimmers).

### 3. Apps Script quota
Apps Script has a daily execution quota (~20,000 calls on personal accounts). No rate limiting implemented. Low risk for single-coach use.

### 4. Single shared sync token, not per-coach
There is one `ACCESS_TOKEN` in Apps Script Script Properties, shared by every coach. This is documented accurately in the Settings modal as of v2.3 (see Fixed section below) but remains a real limitation: there's no way to revoke one coach's access without changing the token for everyone. Would require a token→coach map in Script Properties plus corresponding Apps Script changes if per-coach revocation is ever needed — not implemented.

### 5. Documentation-only: GitHub QT sync has no offline/error retry
`syncQTFromGitHub()` reports a clear error via `setDataError()` on fetch failure (network down, 404, bad JSON) but doesn't retry or queue the request. Coach has to click Sync again manually. Consistent with the Sheets sync error handling, so not considered a bug — just worth knowing.

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
- No DOB/time validation on file load — sanitisation added in `loadDataFiles` (later renamed/split in v2.3, see below)
- Inconsistent `toFixed(3)` vs `toFixed(2)` — standardised to `toFixed(2)`
- Startup `JSON.parse` without try/catch — `lsGet()` helper added
- Footer note hardcoded "SE London Regional" — now reads from `REGIONAL_QT_META.title`

---

## Fixed in v2.2.1 (Gemini regression + security)

Four bugs introduced by a third-party edit to `startSync()`:

1. **Wrong localStorage key** — sync wrote to `'swimmers'`, dashboard reads `'coach_SWIMMERS'`
2. **Wrong variable name** — `swimmers` (lowercase) used instead of `SWIMMERS`
3. **`window.location.reload()` always fired** — `Object.keys(array)` on an array always returns index strings (always truthy)
4. **`mergeSwimmers()` never called** — broken inline merge used instead; merge mode dropdown had no effect

Security fixes:
- Token hardcoded in HTML source → moved to `localStorage` via Settings modal
- Token hardcoded in Apps Script → moved to `PropertiesService`
- `openById(SHEET_ID)` with hardcoded ID → `getActiveSpreadsheet()`
- Apps Script deployment changed from "Anyone with Google account" to "Anyone" (token is the auth gate; Google login redirect was blocking `fetch()` from `localhost`)

---

## Fixed in v2.3

### Data model / structural
- **Removed hardcoded championship date constants** (`COUNTY_CHAMPS_DATE`, `REGIONAL_CHAMPS_DATE`). Age Group calculation, the info banner, and the swimmer-table footer note now all derive the championship date from QT metadata (`COUNTY_QT_META.dateTo`/`dateFrom`, same for Regional) — either synced from GitHub, manually uploaded, or entered via the QT Editor's ✏️ Edit Details form. Previously the banner and age brackets kept showing stale info (e.g. computing against `Invalid Date`) even after QT data was cleared, because they read the hardcoded constant instead of actual loaded-data state.
- **Removed `loadSampleData()`** and the six hardcoded fictional swimmers it injected on first load. First-time / cleared-data state now shows a genuine "no data loaded" empty state.
- **Duplicate `#syncModal` markup removed** — an older, incomplete copy from the original v2.2 build had been left in the DOM alongside the newer Settings-aware version added in v2.2.1. Same `id` on two elements meant the browser's `getElementById` behaviour was ambiguous/fragile. Kept the newer one.
- **Duplicate `fabShowSyncModal()` function** removed (leftover from FAB restructuring).
- **Dead CSS removed:** `.swimmer-name` (superseded by `.swimmer-name-text` since the Phase 5 mobile rework, never actually applied to any element), `.fg.nopb-fg` (target element no longer exists since the No PB toggle moved into `.filter-toggles`).
- **Dead markup IDs removed:** `dataSwimmersLastSync`, `dataCountyLastSync`, `dataRegionalLastSync` wrapper spans in the Manage Data modal — only their inner spans were ever read/written.

### UX / data management
- **Standalone 🔄 Sync FAB removed.** Sheets sync now lives inside the Swimmers card of the redesigned 📤 Manage Data modal (formerly "Load Data Files"). FAB reduced from 5 children to 4.
- **County/Regional QT sync from GitHub added** — new cards in Manage Data, manual-trigger only, no auto-fetch on load.
- **Manage Data modal redesigned** as one card per data source (Swimmers, County QT, Regional QT), each with: sync button (where applicable) → cross-reference hint (if relevant) → file upload row → download/clear row. Previously all three file inputs were bare, undifferentiated, and shared one download button that only covered swimmers.
- **Conflict resolution added for manual uploads.** Previously, uploading a file silently overwrote existing data with no warning. Now: if data already exists, upload shows Replace / Merge (swimmers) or Replace / Merge-add-new / Merge-overwrite-matching (QT) before applying.
- **Clear Data added** — per-card 🗑 Clear button plus a 🗑 Clear All Data button, each behind a `confirm()` dialog naming exactly what will be removed. Wipes both the in-memory array and all related localStorage keys (including legacy fallback keys and `*_LAST_SYNC` timestamps).
- **Download/Clear buttons now disabled when their dataset is empty** — previously clickable even with 0 records loaded.
- **Cross-reference hints added** — if swimmers are loaded but QT data isn't (or vice versa), an inline warning explains why the County/Regional tabs will appear empty, right there in the Manage Data modal.
- **`refreshDataModalStatus()` now called after Sheets sync succeeds** — previously the Manage Data modal (if open underneath the Sync modal) would keep showing a stale swimmer count/last-synced value after a successful sync, only correcting itself as a side effect of some later unrelated action. Root cause: `startSync()`'s success path updated `SWIMMERS` and re-rendered the tabs, but never told the Manage Data modal to refresh its own display.
- **`coach_SHEETS_LAST_SYNC` now cleared when swimmers are wiped** — previously `clearData('swimmers')` reset the swimmer list but left the old "Last synced" timestamp showing, inconsistent with how QT data's own last-sync timestamp was already being cleared.
- **Sync modal now accepts the Apps Script URL inline** when none is configured yet, instead of only showing a warning and requiring a detour to Settings. Field auto-hides once a URL exists (from either source).
- **Settings modal copy corrected** — previously implied per-coach credentials ("each coach enters their own credentials on their own device"), which is misleading given there's a single shared `ACCESS_TOKEN`. Copy now accurately describes it as one shared token stored per-browser, not per-coach authentication.

### Consolidation
- `refreshDataModalStatus()` — previously had three near-identical hint blocks and three near-identical last-sync lookups (one per data source, copy-pasted). Consolidated into small `setCount`/`setHint`/`setLastSync`/`setCardButtons` helpers to reduce the chance of a future edit updating one branch and forgetting the other two — the exact failure pattern behind several bugs earlier in this project's history.
