# Coach Dashboard — Project Brief

## What It Is

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs. It lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times, get a whole-squad "morning briefing" view, and manage all the underlying data (swimmers, QT standards) directly in the browser, with optional sync from Google Sheets and GitHub.

It is a companion tool to an existing **individual swimmer dashboard** (`swim-dash`, hosted at `asushinski9-netizen.github.io/swim-dash`) which tracks one swimmer's personal history. The coach dashboard consumes the same QT JSON file formats.

## Who Uses It

**Swimming club coaches** — not individual swimmers or parents. The audience is someone who needs a squad-wide view rather than a single athlete view.

## Core Goals

1. Show every registered swimmer's PBs alongside County and Regional QT/CT thresholds.
2. Group and filter by Squad, Gender, Age Group, Stroke, Status, and Course.
3. Let coaches manage swimmer and QT data directly in the browser — via sync, manual file upload, or inline editing — without needing to hand-edit raw JSON.
4. Keep data sources clear and recoverable: every dataset can be synced, uploaded, downloaded, or cleared independently, with conflict resolution when uploads collide with existing data.
5. Calculate age groups from the actual championship dates in use (QT Editor / synced metadata) rather than a hardcoded seasonal constant.
6. When a swimmer isn't visible on a tab, tell the coach why rather than leaving them to wonder.
7. Give a coach a fast, whole-squad "what's happening right now" view on landing — composition at a glance, who's actively improving, and who's closest to a breakthrough — without needing to dig through County/Regional tabs one swimmer at a time.
8. Be defensible against bad/malicious input on every data path (manual upload AND sync), not just the ones that happened to be validated first — and be usable via keyboard/screen reader, not just mouse/touch.
9. **(Planned, not yet built — see below)** Let a coach validate manually-tracked PBs against a swimmer's *official* Swim England record, without either data source silently overwriting or displacing the other.

## What It Is Not

- Not a race results entry tool (that lives in the individual swim-dash, or upstream in the Google Sheet that feeds this dashboard's Sheets sync).
- Not a live data feed — sync is always coach-triggered, never automatic on page load. This principle is expected to extend to the planned SE PB import too (see below) — it will be a manual upload action, not a background poll.
- Not multi-user / server-based — data lives in browser `localStorage`; sharing across devices is via Sheets/GitHub sync or downloading and re-uploading JSON files.
- Not a system with per-coach authentication — Sheets sync uses a single shared `ACCESS_TOKEN`, sent as a URL query parameter rather than a header (see `known-bugs-and-fixes.md`, Open Issues #1 and #2 — both explicitly reviewed and deliberately left as-is; real per-coach auth is a feature, not a fix, and deserves its own session).
- The Overview tab is not a filtered/customizable view — it's deliberately a fixed, whole-squad snapshot (no Squad/Gender filter bar), distinct from the filterable County/Regional tabs.
- **Not, and will never be, a scraper of Swim England's public results site.** This was tested and explicitly ruled out — see "Next Planned Work" below.

## Related Files / Repos

| File | Purpose |
|---|---|
| `index.html` | This project — self-contained, no build step |
| `apps_script_v2.2.2.gs` | Google Apps Script Web App — bound to the club's Google Sheet |
| `county_qt.json` | County championship qualifying times (`{meta, times}` format), hosted on GitHub for sync |
| `regional_qt.json` | Regional qualifying times (same format), hosted on GitHub for sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — exportable/importable, also sync-able from the Google Sheet |
| `swim-dash/index.html` | Individual swimmer dashboard (separate project, same QT data) |
| `test_overview.js` | jsdom dev-time test harness for the Overview tab — not shipped with the dashboard |
| `se-pb-import-and-history-plan.md` | **New.** Full plan for the not-yet-built SE PB report import and PB-history feature — see below |

## Current Version

**v2.7** — a short, two-bug mobile follow-up session. Both bugs (the ♂/♀ gender pill still rendering taller than its neighbouring squad badge, and the Manage Data modal's status message overlapping its own Close/Clear All Data buttons) were real symptoms that had *looked* fixed in v2.6 but weren't fully closed — in both cases the v2.6 fix addressed a plausible-but-incomplete layer of the actual root cause. v2.7 re-diagnosed both from scratch: the gender pill needed a fixed-height flex layout plus a Unicode text-presentation selector (not just matched `line-height`), and the modal overlap needed a DOM-order fix (not a CSS change — the sticky-dock CSS from v2.6 was already correct once nothing rendered beneath it). No schema changes, no new features. See `session-log.md` for the full writeup.

## Next Planned Work (leading candidate for v2.8 — not started)

A separate planning conversation (not this session) produced a coach-approved plan to let the dashboard import official Swim England PB reports (exported by the coach from their own SE App account, `.xlsx`, one Short Course + one Long Course file) and cross-check them against the manually-tracked gala PBs already in the dashboard. Full detail — architecture, matching rules, conflict-handling design, and open items — lives in **`se-pb-import-and-history-plan.md`**. In short:

- The original idea (auto-scraping each swimmer's public SE results page using the "SE #" column already in the Google Sheet) was tested and **explicitly ruled out** — Swim England's Website Terms of Use prohibit systematic downloading/database-building from the site, and this is personal data on named individuals (mostly minors) from the sport's governing body. Not a risk-tolerance call; a hard no.
- The unblock: the coach can export the same PB data directly and manually from their own authorised SE App account. That export is the new data source.
- This import can only ever **update PB times on swimmers that already exist** — it must never create, delete, or hide a swimmer, and must never touch `squad`, because SE reports have no squad field and structurally can't list swimmers with no recorded SE time.
- Conflicting values (existing dashboard PB differs from the SE report's PB for the same event/course) are **surfaced for the coach to review and decide, per-row** — not auto-resolved either way — because the coach has flagged that the SE App's own data is sometimes itself incomplete/wrong.
- A related but distinct, less-formed ask (PB progression/history tracking, so an improved-upon PB isn't just discarded) came up at the end of that same planning conversation and explicitly has **not** been designed yet.
- **The coach has approved building the SE report import.** Nothing has been implemented. No sample export file has been provided yet either — needed before parser work can start with confidence, rather than working from screenshots alone.
