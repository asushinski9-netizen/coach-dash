# Coach Dashboard — Session Log

## v1.0 — June 2026

Built entirely in a single Claude chat session. The individual swimmer dashboard (`swim-dash`) already existed; this session created the coach dashboard from scratch as a companion tool.

**Phases:** Foundation (tabs, swimmer cards, filters, FAB) → Swimmer CRUD & Data Management → QT Editor Tabs → Squad Feature → Mobile Improvements → Bug Fixes & Code Quality.

Key design decisions: stat cards count swimmers not event+course combinations; `getEventBestStatuses()` for best-status-per-event across SC+LC; progress bar anchored at CT×1.06 / QT×0.988.

See `known-bugs-and-fixes.md` for the full bug list from this phase.

---

## v2.1 — June 2026 (security & bug patch)

Full code review identified 16 issues, all fixed — CSS class mismatches, `esc`/`esc2` unification into `escAttr()`, unescaped `innerHTML` injections, missing DOB/time validation on file load, try/catch around startup `JSON.parse` (`lsGet()` helper). `100 IM` re-added to `ALL_EVENTS`.

---

## v2.2 — June 2026 (Google Sheets sync)

New feature: PB data pulled from a Google Sheet via a Google Apps Script Web App (`apps_script.gs`). Reads "Basic Data" and "Results" tabs, computes PBs, detects DQs by cell colour, maps Sheet event abbreviations to dashboard names, token-authenticated via `PropertiesService`. Dashboard gained 🔄 Sync and ⚙️ Settings FAB buttons, merge logic (`mergeSwimmers`/`mergePbs`), merge modes (keep/hide/remove local-only swimmers), source badges.

---

## v2.2.1 — June 2026 (security patch + UX fixes)

Fixed a third-party ("Gemini") regression in `startSync()` — wrong localStorage key, wrong variable casing, spurious `window.location.reload()`, `mergeSwimmers()` defined but never called. Security: token fully removed from source (dashboard + Apps Script), moved to `localStorage`/`PropertiesService`; `openById(SHEET_ID)` → `getActiveSpreadsheet()`. UX: sync modal auto-close on success, improved empty states, password-field token input with show/hide.

---

## v2.3 — June–July 2026

Multi-turn session covering: GitHub QT sync, a full Manage Data modal redesign, conflict resolution for manual uploads, championship-date de-hardcoding, and a cleanup pass. Summary: `QT_DATA_URL`/`SE_QT_DATA_URL` GitHub sync added, Manage Data modal rebuilt as one card per source with Replace/Merge conflict resolution, standalone Sync FAB folded into Manage Data, Clear Data added, hardcoded `COUNTY_CHAMPS_DATE`/`REGIONAL_CHAMPS_DATE` constants removed in favour of reading championship dates from QT metadata, and a full doc refresh.

---

## v2.4 — July 2026

Continuation session — a sequence of real bugs found via direct user testing/reporting, each traced to root cause and verified with executable proof (mostly jsdom) before and after the fix:

- **Turn 1:** Sheets-synced swimmers vanishing on manual merge — `mergeSwimmers()` assumed the incoming set was always an authoritative snapshot. Added `opts.sourceIsAuthoritative` so manual-upload merges keep existing swimmers absent from the uploaded file.
- **Turn 2:** Stale sync timestamp + US date format — added `fmtDateTime()`, re-read `coach_SHEETS_LAST_SYNC` on every Sync modal open.
- **Turn 3:** "Not shown" diagnostic added — `diagnoseZeroRowSwimmer()` + expandable footer note splitting excluded swimmers into likely-data-issue vs. genuinely-no-PB.
- **Turn 4:** Collapse All as the default state on every County/Regional tab (re-)open.
- **Turn 5:** Diagnostic footnote gave a wrong reason under an active filter — added a third `'filtered'` category.
- **Turn 6:** Championship banner misstated a date range as a single day — added `describeChampDates()`.
- **Turn 7:** Full codebase review — found and fixed three real stored-XSS vulnerabilities (`escAttr()` double-layer escaping, QT editor `escHtml()`, `sw.gender` escaping).
- **Turn 8:** Former Swimmers unaccounted for in the "not shown" diagnostic — footer note now also scans the full `SWIMMERS` array for the two default/implicit exclusion gates.

---

## v2.5 — July 2026 (this session) — Overview tab

Headline feature: a new **🌅 Overview** tab — a squad-wide "coach's morning briefing" — built from scratch, then refined across many rounds of user feedback (mostly visual/UX polish, one real production bug found and fixed along the way). Now the default tab on page load.

### Build-out

- **Initial four-section design:** Squad Qualification Snapshot (combined County+Regional stat cards), Hot Right Now (recent PBs), The Bubble List (swimmers close to qualifying), Squad Composition (squad/gender/age breakdown). All deliberately unfiltered — no Squad/Gender filter bar of its own, by design (it's a whole-squad glance, not another filterable list like County/Regional).
- **Squad Qualification Snapshot removed** shortly after — user called it overkill/duplicate of information already visible per-tab. Its "X Former Swimmers / hidden swimmers not shown" transparency note was preserved and moved under Squad Composition instead of being deleted.
- **Hot Right Now** and **The Bubble List** were both converted from flat lists to **per-swimmer card grids** (5-up desktop / 2-up mobile) — at this age, a single gala usually produces more than one PB or bubble opportunity for the same swimmer, so grouping by swimmer (not by row) was the right shape from early on.
- **Squad Composition** went through three complete redesigns before landing: plain horizontal bars → single stacked bar (squad) + histogram (age) + donut (gender) → three **matching interactive pie/donut charts**, each with a clickable legend that removes/re-adds a category and recomputes the remaining slices' percentages live, plus a center total that updates to match. Age automatically gets a 2-column legend once it has more than 6 categories.
- **Per-card expand/collapse:** each swimmer's card shows only their single closest/most-recent entry by default, with a "▾ +N more" link revealing the rest. Same pattern extended to the section-level "Showing 10 of 15 swimmers..." notes — a "▾ Show all" / "▴ Show fewer" link reveals or re-collapses the full list, for both sections.
- **Hot Right Now got a configurable day cutoff** (default 30 days, matching a "last month" framing), after the user noticed the feed had no recency window at all — a small/newer squad could otherwise surface a genuinely old PB just because nothing newer existed to displace it. Ordering tie-break: most-recent-date first, then most-PBs-on-that-date (not alphabetical, which is what a plain date sort degenerates to when many swimmers share a gala date) — chosen over "fastest for their age" specifically to keep the feature about *recent activity*, not re-surfacing the same standout swimmers every time.
- **The Bubble List margin** defaults to 5% (raised from an initial 3%), with an "Include hidden / Former Swimmers" toggle that tags any included swimmer with why they're normally hidden. Sort: smallest gap first, tie-broken by most opportunities (not alphabetical).

### Entry-row design iteration (the bulk of the back-and-forth this session)

The single most-revised piece of UI this session. In order:
1. Flat one-line flex row (event, course, time, date) with the date pushed to the far right via `margin-left:auto` — worked, but looked scattered.
2. A genuine spreadsheet-style CSS Grid (fixed-width columns, all 5 pieces same font-size) — fixed the alignment but user found it visually flat/uninteresting.
3. **Option A/B/C explored** (colored accent + grouped text / time-as-hero-stat two-line / chip-grouped) — user picked B.
4. B's first implementation stretched time and date apart with `space-between` on a shared baseline — user reported "values are all over the place." Fixed by **grouping time and date into one right-aligned result block** (time leads, date sits directly beneath it as a caption) instead of spreading them across the row.
5. Added a **colored left accent bar keyed to stroke** (Free/Back/Breast/Fly/IM, reusing hex values already established elsewhere in the app for squad/gender) to visually thread the two columns together.
6. Applied the same two-column layout + accent bar to **The Bubble List** for consistency, replacing its percentage-based stat with the actual **time difference in seconds and the QT cutoff itself** ("0.12s off" / "QT 2:24.00") per a follow-up request — dropped a leading `+` sign after it was flagged as ambiguous (every bubble entry is by definition still short of qualifying, so a bare sign invites the wrong reading).
7. Bubble List's meta line split into **two rows** — championship type (County/Regional) on its own line, event + course underneath — on request, for a cleaner scan when comparing a swimmer's County vs Regional opportunities.
8. Considered adding CT (Consideration) times to Bubble List entries — reasoned through when it would/wouldn't be redundant (almost always redundant at the default margin, since QT-proximity implies CT is already cleared; only meaningful at wide margins for Outside-status swimmers) and **declined** per the user's call rather than building it speculatively.

### Real production bug found and fixed (not just polish)

**Mobile Age-composition legend digit truncation** — some 2-digit ages (12, 13, 14, 15) rendered as a bare "1"; others (16, 17, 18, 19) rendered fine. Root cause was **not** container width (already flexible) but `.ov-legend-label { min-width: 0 }`, which let a long *adjacent* count string (e.g. "15 (18%)" vs "7 (8%)") squeeze that specific row's label down to sub-one-character width — exactly matching the observed pattern (truncation correlated with longer counts, not with digit count). Fixed with `min-width: 2.4ch`, guaranteeing at least 2 digits regardless of the neighbouring count's length.

### Other polish this session

- Mobile header: tagline ("County & Regional QT Tracker") now drops to its own row under the club name via a hideable separator span, instead of wrapping mid-phrase.
- Mobile tab bar: Overview now takes the full first row (`:first-child` selector, no markup change needed), pushing County/Regional to pair up on row 2.
- Expanded card background changed from gray to a light blue tint (reusing the same rgba-blue pattern already established for the info banner, so it's correct in both light and dark theme rather than a flat hardcoded color).
- Mobile stroke abbreviations (FR/BK/BR/FLY/IM) via the dashboard's existing `.col-full`/`.col-abbr` pattern — same mechanism already used elsewhere, not a new one.

### Testing approach

All of the above was verified with a dedicated jsdom test harness (`test_overview.js`, ~430 lines, not part of the shipped dashboard) run against the real extracted `<script>` block and the actual project sample data files, rather than read-through alone. Caught and fixed two real bugs in the *test* itself along the way (a test-ordering issue where an earlier mutation was read by a later "default value" assertion; a tie-break test whose synthetic fixture data accidentally exercised the wrong code path). Every visual/behavioral change in this log was confirmed with a real rendered sample and/or a `getComputedStyle` assertion, not just presence-of-markup.

---

## v2.6 — July 2026 (this session) — Codebase review, security/a11y hardening, mobile fixes

A two-part session: two direct mobile bug reports handled first, then a full deliberate codebase review at the user's request, with everything it surfaced rolled out in the same session, plus one more mobile UX fix in a final follow-up turn.

### Part 1 — Two direct mobile bug reports

1. **Gender-pill / squad-badge height mismatch** (screenshot: "AA"/"AC"/"AD" swimmer cards, female/male symbol pill visibly taller than the squad badge next to it). Root cause: `.gender-pill-mobile` used a relative `line-height: 1.6` while `.squad-badge` used the browser default — combined with their different `font-size`s, the two pills could never match height regardless of padding tuning. Fixed by giving both a shared fixed `line-height: 15px` + `padding: 2px 8px`. CSS-only, verified via `getComputedStyle` that both now compute identically.
2. **Bubble List event text wrapping on narrow phones** (screenshot: event/course text on a second line on some cards). Looked like "font too big"; root cause was actually a specificity bug — `.ov-entry-stat-meta .badge` (two classes) beat the generic mobile `.badge` override regardless of media query, so the SC/LC course pill never actually shrank on mobile at all, staying at desktop size next to already-abbreviated event text. Fixed with a matching-specificity mobile override, plus tightened `.ov-entry-stat-meta`'s own font-size/gap. Since Hot Right Now and Bubble List share `.ov-entry-stat-meta`, one fix covered both automatically — no separate change needed for "keep it consistent," as requested.

### Part 2 — Full codebase review (user-requested) → 20-item punch list, all rolled out

The user asked for "a thorough review of the codebase for any leftover comments, bugs, security issues, UI concerns, improvement opportunities etc." Produced a prioritised 20-item list (security, bugs, UI/accessibility, improvement opportunities) presented for evaluation before any changes — the user said "roll them all out." All 20 were implemented, plus **two more found while implementing them**, not on the original list:

- **`.tbl-wrap` had zero matching CSS** — the QT Editor's table-wrapper class was used in markup with nothing defining it, so no horizontal-scroll containment. Added, mirroring `.swimmer-table-wrap`.
- **A real stored-XSS vulnerability**, found while adding defense-in-depth escaping to a *different*, non-exploitable spot. Hot Right Now's `collectRecentPbs()` reads `sw.pbs` directly rather than going through the `ALL_EVENTS`-constrained lookup path everything else uses, and rendered `pb.course` completely unescaped inside a `class="badge ${e.course}"` attribute — with zero validation of `pb.event`/`pb.course` anywhere in the sanitiser at the time. Fixed at the root (sanitiser now validates both) and at render time (escaped, as defense-in-depth). Verified with a dedicated jsdom XSS probe: payload rejected by the sanitiser; when injected directly bypassing it, renders as inert escaped text with zero script execution and zero `<img>` elements actually created in the DOM.

**Security:** every `localStorage.setItem()` write wrapped (previously only reads were) via a new `lsSet()`, with real user-facing failure messages instead of silent uncaught throws; Sheets-sync data now runs through the same sanitiser manual uploads always used (previously bypassed entirely); PB `date` validated (a bad one is dropped, not left to render as "NaN undefined NaN" or corrupt Hot Right Now's sort); QT upload *and* GitHub sync both validated for the first time (`sanitiseQTData()`, closing Open Issue #7); Apps Script's token check hardened to a constant-time-ish comparison; Apps Script's `setToken()` guarded against an accidental overwrite; the long-stale legacy-localStorage-key fallback (Open Issue #2) completed its migration instead of being read forever.

**Accessibility:** removed the pinch-zoom-disabling viewport lock (a WCAG 1.4.4 failure); added keyboard support (`role="button"`, `tabindex`, `kbActivate()`, a visible focus ring) to every mouse-only "clickable div" (swimmer headers, stat cards, chart legend items); added real dialog semantics (`role="dialog"`, `aria-modal`, `aria-labelledby`) plus focus-trap-and-restore to all four modals; added `aria-label`s to the FAB buttons (previously `title`-only) with a synced `aria-expanded`.

**Data-quality / UX:** a real (if one-time-per-session) user-facing warning when localStorage approaches its size limit, replacing a console-only log; the Overview tab's day-cutoff and margin% now persist as coach preferences across reloads (the rest of its session state stays intentionally ephemeral, unchanged); GitHub QT sync now retries transient failures with backoff instead of failing on the first blip; the name-search filter debounces instead of re-rendering the full tab per keystroke; sanitisation results (skipped/dropped/coerced counts) now show up in the actual status message, not just the console; `pb.competition` (collected since early Overview work, never displayed) now shows as a tooltip on Hot Right Now entries; `r.event`/`r.course`/bubble-list `e.course` escaped for consistency even where already safe by construction.

Every change verified with `node --check` after each edit, targeted jsdom probes for the security/accessibility-sensitive changes specifically (XSS payload rejection, focus-trap/restore behaviour, dock visibility toggling, retry-with-backoff behaviour against a mocked flaky `fetch`), and a full run of the existing `test_overview.js` suite at multiple checkpoints — no regressions at any point. A synthetic `swimmers_pb.json` was generated purely to exercise the test suite locally; it isn't part of the delivered files.

### Part 3 — Follow-up: Manage Data modal warnings hidden on mobile

Reported after the review was already shipped: on mobile, status/error/conflict messages in Manage Data sat below three data-cards in normal document flow, so an upload-triggered merge conflict or sync error could go unnoticed unless the coach scrolled down afterward (desktop was fine — taller viewport). Fixed by wrapping the three elements in a dock that becomes `position: sticky` at the bottom of the modal's own scroll area the instant any of them has something to show (`refreshStatusDockVisibility()`, toggling a `dock-visible` class), and disappears with no empty floating bar otherwise. Mobile-only; desktop untouched as requested. Verified the toggle behaves correctly across all five show/hide entry points (status, error, conflict — set and cleared).

### Versioning note

Two Apps Script hardening changes (token comparison, `setToken()` guard) came out of the review too. The user caught that this should bump the `.gs` file's own version rather than silently changing behaviour under the old v2.2.1 label — file renamed to `apps_script_v2.2.2.gs` with an updated header comment. `index.html`'s `<title>` tag was also found stale (still said "v2.2" despite being several versions past that) and corrected to v2.6.

---

## Files — current state (v2.6)

| File | Version | Description |
|---|---|---|
| `index.html` | v2.6 | Main dashboard — ~3,910 lines |
| `apps_script_v2.2.2.gs` | v2.2.2 | Google Apps Script — token-check + `setToken()` hardening this session |
| `test_overview.js` | v2.5 | jsdom dev-time test harness for the Overview tab (not shipped) — ~430 lines, unchanged this session, still passes in full |
| `project-brief.md` | v2.6 | Project overview and goals |
| `architecture.md` | v2.6 | Code structure and data flow |
| `data-schema.md` | v2.6 | All JSON schemas |
| `known-bugs-and-fixes.md` | v2.6 | Bug log |
| `session-log.md` | this file | Full session history |
| `coach_dashboard_handover.md` | v2.6 | Executive handover, written for a fresh chat session |

