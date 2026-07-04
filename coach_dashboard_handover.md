# Coach Dashboard — Handover Document (v2.4)

**Dashboard:** `index.html` · **~2,930 lines** · Self-contained (logo embedded as base64)
**Apps Script:** `apps_script_v2.2.1.gs` · **252 lines** · Bound to Google Sheet, unchanged since v2.2.1
**Read this first if you're picking this project up in a new chat session.**

---

## 1. What It Does

A single-file HTML coaching dashboard for Broomfield Park SC. Shows every swimmer's Personal Bests against County and Regional qualifying times. Three independent data sources, each syncable, uploadable, downloadable, and clearable from one "📤 Manage Data" modal:

1. **Swimmers & PBs** — synced live from a private Google Sheet via a Google Apps Script Web App, or uploaded/downloaded as `swimmers_pb.json`.
2. **County QT data** — synced from a GitHub-hosted `county_qt.json`, or uploaded/downloaded/edited inline via the QT Editor tab.
3. **Regional QT data** — same, for `regional_qt.json`.

**Related tool:** Individual swimmer dashboard (`swim-dash`) at `asushinski9-netizen.github.io/swim-dash` — uses the same QT JSON file formats.

---

## 2. How to Run

Must be served from `localhost` — not opened as a `file://` URL. The `fetch()` call to the Apps Script (Sheets sync) fails with a CORS error from `file://` origin.

```
python3 start.py        # Mac/Linux — auto-finds free port, opens browser
start.bat                # Windows
```
Or manually: `python3 -m http.server 8000` then open `http://localhost:8000/index.html`

---

## 3. Championship Dates — No Hardcoded Constant

There is no hardcoded championship date constant. Age Group calculation, the info banner, and the swimmer-table footer note all read the championship date from **QT metadata**:

```js
function getCountyChampsDate()   { return COUNTY_QT_META.dateTo || COUNTY_QT_META.dateFrom || ''; }
function getRegionalChampsDate() { return REGIONAL_QT_META.dateTo || REGIONAL_QT_META.dateFrom || ''; }
```

**If no QT data is loaded at all, Age Groups can't be calculated** — the dashboard shows this explicitly rather than guessing or crashing. This is intentional.

**New in v2.4:** `champDate` (the value these two functions return) is `dateTo` when both dates are set — i.e. the *last* day of the event, not necessarily the only day. The info banner used to say "took place on {champDate}" as if that were the whole event, which is wrong for a multi-day championship. There's now a `describeChampDates(qtMeta, isPast)` helper that looks at `dateFrom`/`dateTo` together and picks the right phrasing — a range ("took place from 7 Feb to 15 Feb"), a genuine single day, or an honest "began on"/"concluded on" when only one end of the range is actually known. If you touch the banner text again, use this helper rather than reintroducing a single-date assumption.

---

## 4. First-Time Setup (new browser / new coach)

1. Open ⚙️ Settings (FAB button) → paste the Apps Script Web App URL + sync token → Save.
2. Open 📤 Manage Data (FAB button):
   - Swimmers card → 🔄 Sync from Google Sheet
   - County QT card → 🔄 Sync from GitHub
   - Regional QT card → 🔄 Sync from GitHub

URL and token are stored in `localStorage` only — not in the file. Each coach pastes the **same** URL and token (see §6 — this is not per-coach authentication).

---

## 5. Architecture Summary

```
Google Sheet (private)                    GitHub repo (public, read-only)
  └─ Apps Script Web App                     └─ county_qt.json / regional_qt.json
       Token auth via PropertiesService
       (token sent as a URL query param, not a header — see §9, item 1)

Dashboard (localhost)
  ├─ SWIMMERS[], COUNTY_QT[], REGIONAL_QT[] + META objects, all in localStorage
  ├─ 📤 Manage Data modal — 3 cards (Swimmers / County QT / Regional QT):
  │    sync button → cross-reference hint → upload row → download/clear row
  │    manual uploads over existing data trigger a Replace/Merge conflict prompt
  ├─ QT Editor tabs (desktop only) — inline editing, competition metadata (dates!)
  ├─ "Not shown" diagnostic — every swimmer-list tab has an expandable footer note
  │    explaining exactly why any given swimmer isn't visible right now (see §7)
  └─ FAB: 👤 Add Swimmer · 📤 Manage Data · ⚙️ Settings · 🌙 Theme
```

Full detail in `architecture.md`. Full JSON shapes in `data-schema.md`.

---

## 6. Single Shared Token — Not Per-Coach Auth

There is exactly **one** `ACCESS_TOKEN` set in the Apps Script's Script Properties. Every coach pastes the *same* URL and token into their own browser — this is not per-coach login, and there's no way to revoke one coach without changing it for everyone. Documented accurately in the Settings modal copy (fixed in v2.3).

**Also worth knowing (found in v2.4, not yet fixed):** the token is sent as a URL query parameter — `GET ${syncUrl}?token=${token}` — not as a header. This risks the token appearing in browser history and any server/proxy access logs that record full request URLs. The correct fix is a `doPost` handler in the Apps Script reading the token from the request body instead of `e.parameter.token`. Not done yet because it needs a coordinated change to `apps_script_v2.2.1.gs`, which wasn't available to inspect this session — changing only the client would risk breaking a working sync without the ability to test against the real endpoint. If you're picking this up with the `.gs` file in hand, this is a good next thing to fix properly.

---

## 7. The "Not Shown" Diagnostic (new in v2.4 — built across several turns)

Every County/Regional tab footer has an expandable note: **"N swimmer(s) shown · M not shown (click for why)."** This exists because a swimmer's whole card silently disappears — not greyed out, not shown as "no PB," just absent — whenever they produce zero comparison rows, and there are five genuinely different reasons that can happen:

| Reason | Meaning |
|---|---|
| `no-match` | Zero QT rows matched this swimmer's gender+age-bracket at all — usually a malformed `dob` or unexpected `gender` value. **Only category styled as an actual warning** (gold/⚠️), since it's the only one that's a real problem to look at. |
| `no-pbs` | QT matched fine, but genuinely zero PBs recorded for any offered event |
| `filtered` | Has real PB(s), but none satisfy the currently active Course/Stroke/Status filter — described with their actual best status, e.g. "best: Outside" |
| `former` | Squad = Former Swimmer, hidden by the default gate regardless of any filter |
| `hidden` | Demoted to local-only by a Sheets sync "Hide" merge |

**Deliberately not tracked:** exclusions caused by an explicit Gender/Age/Squad/Name-search filter selection. Those are self-evident from the filter bar the coach can see is set — the whole point of this diagnostic is to explain *surprising* disappearances, not routine filter behaviour.

If you extend this diagnostic further, the natural next candidate is the explicit-filter case above, if a future request specifically asks for it — but resist adding it unprompted; it was explicitly scoped out once already because it risks turning a concise note into a list of 40+ names every time a coach sets Gender=Boys.

`former`/`hidden` are seeded from the **full** `SWIMMERS` array, not from `visibleSwimmers` — they're excluded one step earlier in the pipeline than the other three reasons, so if you add a new implicit/default exclusion gate in future, seed it the same way (see `diagnoseZeroRowSwimmer`'s neighbouring code in `renderTab`, and `buildFooterNote` for how the buckets get rendered).

---

## 8. Data Schemas (summary — full detail in `data-schema.md`)

**Swimmer:** `{id, name, dob(YYYY-MM-DD), gender(Boys/Girls), squad, source(sheet/local), hidden(bool), pbs[]}`

**PB entry:** `{event, course(S/L), time(mm:ss.hh or ss.hh), date(YYYY-MM-DD), competition?}`

**QT file:** `{meta:{title,dateFrom,dateTo}, times:[{gender,course(Short/Long Course),event,age,qualify(secs),consider(secs)}]}`

**Squad values:** Development · Junior · Senior · Active · Masters · Former Swimmer

**Age brackets — County:** 10+11 / 12 / 13 / 14 / 15 / 16 / 17+
**Age brackets — Regional:** 11/12 / 13 / 14 / 15 / 16 / 17 / 18+

**Sync timestamps** (new in v2.4): always `DD/MM/YYYY, HH:MM` (24hr) via `fmtDateTime()`, never `.toLocaleString()` — the latter defaults to browser locale and previously showed US `M/D/YYYY` format regardless of where the club is based.

---

## 9. Known Issues (see `known-bugs-and-fixes.md` for full history)

1. **Sync token sent as a URL query parameter, not a header** — see §6. Real risk, not yet fixed, needs the `.gs` file to fix properly.
2. **Legacy localStorage keys** (`coach_COUNTY_QT`, `coach_REGIONAL_QT`) still read as fallbacks, never written since v2.0. Harmless.
3. **Single shared sync token** — see §6.
4. **No offline/retry queue** for either sync path — consistent behaviour, not a bug.
5. **Manual-upload validation doesn't cover every field.** `sanitiseSwimmersData()` validates `name`/`dob`/`gender`/PB `time` but not `id`; `applyQTUpload()` validates nothing at all on QT files. This is **not currently a security hole** — v2.4 fixed the actual rendering-side escaping that this gap would otherwise have exposed (see §10) — but it does mean a QT file with a garbage `event` string will silently fail to match anything rather than being rejected with a clear upload error. Low priority.

---

## 10. Security Fixes in v2.4 — Read This Before Touching `escAttr`/`escHtml`

A requested full codebase review found and fixed **three real, exploitable stored-XSS vulnerabilities**, each confirmed with an actual jsdom proof-of-concept (constructing the real page, feeding it malicious data, and checking whether injected markup/attributes actually landed in the live DOM) both before and after the fix — not inferred from reading the code.

1. **`escAttr()` only escaped half its job.** It's used for `onclick="fn('${escAttr(x)}')"` — a JS string nested inside an HTML attribute — but only escaped backslash/single-quote (the JS-string layer), never double-quote (the HTML-attribute layer). A crafted `id` in an uploaded `swimmers_pb.json` broke straight out of the attribute and injected a real, browser-executed event handler. **Fixed:** `escAttr()` now escapes both layers, in the correct order (JS-string escaping first, then HTML-entity escaping — reversing this order would let the HTML entities get reinterpreted as JS escape sequences).
2. **QT Editor rendered `gender`/`event` as raw HTML text**, not inside any attribute — a different injection class entirely, and `escAttr()` was never even in the picture for this one. A crafted `event` string in an uploaded QT file rendered as a real, executing DOM element. **Fixed:** wrapped in `escHtml()`.
3. **`sw.gender` unescaped in the swimmer card meta line.** Lower risk since manual uploads validate gender strictly, but Sheets sync bypasses that validation entirely (see §9 item 5), so it wasn't actually safe. **Fixed** for consistency with `sw.squad` (already escaped since v2.1).

**If you add any new field to a rendered template literal**, the rule going forward: `escHtml()` for anything that becomes visible text content, `escAttr()` for anything embedded inside an `onclick="..."` attribute (never just one or the other — they solve different problems and neither substitutes for the other). Don't assume a field is "probably fine" because an upload validator checks it elsewhere — as demonstrated twice this session, Sheets sync and QT uploads both bypass validation paths that manual swimmer uploads go through, so the *rendering* layer is the only real security boundary, not the *input* layer.

---

## 11. A Note on Debugging in This Codebase

This session's approach, worth continuing: **when a bug is reported, trace it to an exact root cause in the actual file before touching anything, then verify the fix with an executable test against the real code — not a plausible-sounding explanation.** Concretely, this meant:
- Extracting the actual functions from `index.html` (via a small Node script that pulls out the `<script>` block and `eval`s just the relevant function bodies) and running them against synthetic data matching the reported scenario exactly, both before and after a fix.
- For anything DOM-related (rendering, tab state, XSS), using `jsdom` with `runScripts: 'dangerously'` to execute the *real* page and inspect the *real* resulting DOM — including a `beforeParse(window)` hook to seed `localStorage` before the page's own module-level init code runs (this matters: `let`/`const` top-level declarations don't attach to `window`, and localStorage must be seeded *before* the document's `<script>` tags execute, not after `new JSDOM()` returns).
- For the security fixes specifically, writing an actual injection payload and checking whether it survived a browser re-parse (`element.innerHTML = maliciousOutput; testDiv.querySelector(...)` — counting resulting attributes/elements), rather than eyeballing whether escaping "looked right."

This project has a history of subtle, easy-to-miss bugs (documented across `known-bugs-and-fixes.md`) that look fine on a read-through but fail on actual execution — prefer running the code over reading it whenever a claim can be checked either way.

---

## 12. Parked Ideas (carried forward, still not started)

**Overview tab** — "coach's morning briefing" page:
1. Squad qualification snapshot (across both County + Regional simultaneously)
2. "Hot right now" — feed of most recently set PBs, sorted by date
3. "The bubble list" — swimmers within X% of a QT they haven't hit yet
4. Upcoming competition countdown with qualifier counts
5. Swimmers with zero PBs recorded — **note:** the v2.4 "not shown" diagnostic already surfaces this per-tab (the `no-pbs` bucket); a dedicated Overview-tab version of this idea should probably just reuse `diagnoseZeroRowSwimmer`/`buildFooterNote` rather than reimplementing the check.

**Other deferred:** Import PBs from CSV · Event coverage map (grid of events × squads) · Top performers per event (relay selection) · PB age/stale-times alert · Print/PDF view · Swimmer notes field · Sort swimmer list by age group or squad · Per-coach token revocation (see §6) · Proper `doPost`-with-body token transport (see §6/§9 item 1) · Extending manual-upload validation to cover `id` (swimmers) and all QT fields (see §9 item 5) — lower priority now that the rendering-side escaping closes the actual security exposure, but still worth doing for data-quality/error-messaging reasons.

---

## 13. Files in This Release

| File | Description |
|---|---|
| `index.html` | Main dashboard |
| `apps_script_v2.2.1.gs` | Google Apps Script (unchanged since v2.2.1) |
| `start.py` / `start.bat` | Localhost launchers |
| `SETUP.md` | Apps Script deployment guide |
| `project-brief.md` | Project overview and goals |
| `architecture.md` | Code structure, data flow, key logic — most detailed technical doc |
| `data-schema.md` | All JSON schemas and field reference |
| `known-bugs-and-fixes.md` | Full bug log with root causes, v1.0 through v2.4 |
| `session-log.md` | Turn-by-turn history of this session plus prior version summaries |
| `coach_dashboard_handover.md` | This document |
