# Coach Dashboard — Handover Document (v2.5 → starting v2.6)

**File:** `index.html` · **Lines:** ~3,555 · **Self-contained:** yes (logo embedded as base64) · **Test harness:** `test_overview.js` (~430 lines, jsdom, dev-time only — not shipped)

---

## 1. What Changed This Session (v2.5)

One feature: a new **🌅 Overview tab** — a squad-wide "coach's morning briefing" — now the **default tab on page load**. Three sections, top to bottom:

1. **Squad Composition** — three matching interactive pie/donut charts (Gender / Squad / Age), each with a clickable legend that removes/re-adds a category and live-recomputes the remaining percentages.
2. **🔥 Hot Right Now** — recent PBs, grouped into one card per swimmer (5-up desktop / 2-up mobile), with a configurable "last N days" cutoff (default 30).
3. **🎯 The Bubble List** — swimmers within a configurable % margin (default 5) of a County/Regional QT they haven't hit yet, same per-swimmer card grid.

Both card-grid sections cap at 10 cards with a "▾ Show all" link to reveal the rest; each card shows only its single closest/most-recent entry by default with a "▾ +N more" link to expand.

**A Squad Qualification Snapshot section existed briefly and was removed** — flagged as duplicate/overkill of information already visible per-tab. If it comes up again, know that it was tried and explicitly rejected, not just never considered.

**No data schema changes, no new localStorage keys, no new dependencies.** Everything is hand-rolled SVG/CSS — deliberately, to preserve the file's self-contained architecture (this was an explicit design constraint honored throughout, e.g. when asked about pie charts, colored accents, etc.).

---

## 2. The One Real Bug Found (worth knowing about for pattern-matching)

**Mobile Age-legend digit truncation:** some 2-digit ages showed as a bare "1". Looked like a container-width problem; wasn't. Actual cause: `.ov-legend-label { min-width: 0 }` let a long *adjacent sibling's* text (the count, e.g. `"15 (18%)"`) squeeze the label down to sub-1-character width on that specific row, while a shorter count on another row left plenty of room — which is exactly why the truncation pattern didn't correlate with "2 digits" but with "long count string." Fixed with `min-width: 2.4ch`. **Lesson for future layout bugs in this file:** a flex child with `min-width: 0` next to a `flex-shrink: 0` sibling will always squeeze first when the row is tight, regardless of which one "looks like" the culprit — check the sibling's content length before assuming the container is too narrow.

---

## 3. Design Iteration History (so you don't re-litigate settled decisions)

The Hot Right Now / Bubble List entry row was rebuilt **five times** in direct response to feedback, in this order — useful context if similar feedback comes up again:

1. Flat one-line flex row, date pushed right via `margin-left: auto` → felt scattered.
2. Genuine CSS-grid "spreadsheet" layout (fixed columns, uniform font-size) → technically fixed alignment, but felt visually flat/uninteresting.
3. Offered three named options (A: colored accent + grouped text, B: time-as-hero-stat two-line, C: chip-grouped) → **B was chosen.**
4. B's first cut used `justify-content: space-between` to spread time and date across the row on a shared baseline → reported as "values are all over the place." **Fixed by grouping time and date into one right-aligned block** (time leads, date is its caption directly underneath) instead of spreading them.
5. Still felt disconnected → **added a colored left accent bar keyed to stroke** (reusing existing squad/gender hex values, not a new palette) to visually thread the two columns together. This is the current, settled design.

Bubble List was then brought in line with the same layout, with two Bubble-specific follow-ups: the displayed stat changed from a percentage to the actual **time difference + QT cutoff** (`"0.12s off"` / `"QT 2:24.00"`), and a leading `+` sign was removed after being flagged as ambiguous (every Bubble List entry is by definition short of qualifying, so a sign added no information, only ambiguity). Its meta line is two rows (championship type, then event) rather than one run-on line, per explicit request.

**If starting v2.6 with more visual polish requests on this section:** the current design (two-column, grouped result block, stroke accent bar) has been through five rounds of direct feedback and is the settled state — treat further requests as refinements to this, not a reason to start over, unless the person clearly wants a different direction.

---

## 3a. A Design Question Considered and Declined

Adding CT (Consideration) times to Bubble List entries was raised and reasoned through: almost always redundant (a swimmer close enough to QT to appear in the Bubble List has nearly always already cleared the easier CT standard), genuinely useful only for Outside-status swimmers at wide margins. **Declined by the user** rather than built. Don't re-propose this unprompted; if it comes up again, the reasoning above is still valid.

---

## 4. Architecture (only what's new — full detail in `architecture.md`)

### Key new functions/constants (all in the "OVERVIEW TAB" section of `<script>`, ~450 lines)

| Area | Names |
|---|---|
| Shared helpers | `getOverviewEligibleSwimmers`, `hiddenReasonDetail`, `splitEventDistance`, `STROKE_ABBR`, `STROKE_COLOR`, `renderPersonCard` |
| Composition | `renderCompChart`, `toggleCompChartKey`, `compChartExcluded`, `renderComposition`, `SQUAD_COLORS`, `GENDER_COLORS`, `getCurrentAge` |
| Hot Right Now | `collectRecentPbs`, `groupRecentPbsBySwimmer`, `renderHotList`, `getHotCutoffDays`, `getHotCutoffDate`, `HOT_CARD_CAP`, `hotExpanded`, `hotShowAll`, `toggleHotExpand`, `toggleHotShowAll` |
| Bubble List | `buildBubbleList`, `groupBubbleEntriesBySwimmer`, `renderBubbleList`, `BUBBLE_CARD_CAP`, `bubbleExpanded`, `bubbleShowAll`, `toggleBubbleExpand`, `toggleBubbleShowAll` |
| Master render | `renderOverview()` — calls all of the above; called on load and after every data-changing action (same call sites as `renderCounty()`/`renderRegional()`) |

### Things to know before touching this code

- **`renderPersonCard` is shared** by both Hot Right Now and The Bubble List. Changing its signature or the `.ov-person-card`/`.expanded` CSS affects both sections.
- **`.ov-entry-stat` / `.ov-entry-stat-meta` / `.ov-entry-stat-result` / `.ov-entry-stat-time` / `.ov-entry-stat-date`** are the shared entry-row classes. Bubble List additionally uses `.ov-bubble-meta` / `.ov-bubble-meta-tab` / `.ov-bubble-meta-event` as a modifier for its two-row meta (Hot Right Now's meta stays single-row).
- **Session-only state** — chart toggles, expand/collapse, show-all/fewer, day cutoff, margin % — none of it persists across a reload. This is consistent with existing `collapseAllState` behavior elsewhere, so treat it as intentional, not a gap, unless asked to change it.
- **The Overview tab has no filter bar and this was a deliberate decision**, asked about explicitly and declined in favor of simplicity ("a single glance at the whole squad, not another filterable list"). Revisit only if asked.

---

## 5. Testing Approach Used This Session

Every change was verified by extracting the real `<script>` block and running it under jsdom (`test_overview.js`), seeded with the actual project sample data files — not just read-through. This caught two bugs in the *test* itself along the way (a test-ordering issue, and a tie-break test whose fixture data accidentally exercised the wrong code path) in addition to the one real production bug (see §2). Recommend continuing this approach for v2.6: extract `<script>` → `node --check` → run/extend `test_overview.js` → confirm with a real rendered sample (`node -e '...'` printing `outerHTML` or checking `getComputedStyle`) before considering a change done. Don't rely on markup presence alone (`querySelector` finding an element isn't proof it *looks* right) — several of this session's fixes specifically required checking computed styles or actual rendered values to catch what a purely structural check would have missed.

---

## 6. Suggested Directions for v2.6 (not commitments, just where things were left)

| Priority | Idea |
|---|---|
| Carried over | `doPost` + JSON-body token fix for Sheets sync (Open Issue #1) — `.gs` file has been available since before this session but wasn't touched |
| Possible | Persist some Overview session-state as coach preferences (day cutoff, margin %) if it turns out coaches want it to stick across reloads — flagged, not requested |
| Possible | Event-coverage heatmap or qualification-trend sparkline — floated as ideas in this session's early design discussion, not built |
| Low | Persist `hotShowAll`/`bubbleShowAll`/expand state per-tab-visit rather than resetting — only if it becomes an annoyance in practice |

---

## 7. Files — Current State

| File | Version | Description |
|---|---|---|
| `index.html` | v2.5 | Main dashboard |
| `apps_script_v2.2.1.gs` | v2.2.1 | Unchanged since v2.2.1 |
| `test_overview.js` | v2.5 | jsdom dev-time harness — not shipped |
| `project-brief.md` | v2.5 | |
| `architecture.md` | v2.5 | |
| `data-schema.md` | v2.5 (content unchanged from v2.4) | |
| `known-bugs-and-fixes.md` | v2.5 | |
| `session-log.md` | v2.5 | Full turn-by-turn history |
| `coach_dashboard_handover.md` | this file | |
