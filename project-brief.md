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
7. **(New, v2.5)** Give a coach a fast, whole-squad "what's happening right now" view on landing — composition at a glance, who's actively improving, and who's closest to a breakthrough — without needing to dig through County/Regional tabs one swimmer at a time.

## What It Is Not

- Not a race results entry tool (that lives in the individual swim-dash, or upstream in the Google Sheet that feeds this dashboard's Sheets sync).
- Not a live data feed — sync is always coach-triggered, never automatic on page load.
- Not multi-user / server-based — data lives in browser `localStorage`; sharing across devices is via Sheets/GitHub sync or downloading and re-uploading JSON files.
- Not a system with per-coach authentication — Sheets sync uses a single shared `ACCESS_TOKEN`, sent as a URL query parameter rather than a header (see `known-bugs-and-fixes.md`, Open Issue #1 — still not addressed as of v2.5).
- The Overview tab is not a filtered/customizable view — it's deliberately a fixed, whole-squad snapshot (no Squad/Gender filter bar), distinct from the filterable County/Regional tabs.

## Related Files / Repos

| File | Purpose |
|---|---|
| `index.html` | This project — self-contained, no build step |
| `apps_script_v2.2.1.gs` | Google Apps Script Web App — bound to the club's Google Sheet, unchanged since v2.2.1 |
| `county_qt.json` | County championship qualifying times (`{meta, times}` format), hosted on GitHub for sync |
| `regional_qt.json` | Regional qualifying times (same format), hosted on GitHub for sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — exportable/importable, also sync-able from the Google Sheet |
| `swim-dash/index.html` | Individual swimmer dashboard (separate project, same QT data) |
| `test_overview.js` | jsdom dev-time test harness for the Overview tab (v2.5) — not shipped with the dashboard |

## Current Version

**v2.5** — a single-feature session (the Overview tab), but a long one: most of the effort went into iterating the Overview tab's visual design against direct, repeated user feedback (the Hot Right Now / Bubble List entry row alone went through five distinct layouts) rather than into breadth of new functionality. One genuine production bug was found and fixed along the way (a mobile legend digit-truncation bug, root-caused to a flex min-width squeeze rather than the container-width issue it first appeared to be). No data schema changes, no new localStorage keys, no new dependencies. See `session-log.md` for the full turn-by-turn history and `coach_dashboard_handover.md` for a new-session-ready summary.
