# Coach Dashboard — Project Brief

## What It Is

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs. It lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times — and manages all the underlying data (swimmers, QT standards) directly in the browser, with optional sync from Google Sheets and GitHub.

It is a companion tool to an existing **individual swimmer dashboard** (`swim-dash`, hosted at `asushinski9-netizen.github.io/swim-dash`) which tracks one swimmer's personal history. The coach dashboard consumes the same QT JSON file formats.

## Who Uses It

**Swimming club coaches** — not individual swimmers or parents. The audience is someone who needs a squad-wide view rather than a single athlete view.

## Core Goals

1. Show every registered swimmer's PBs alongside County and Regional QT/CT thresholds.
2. Group and filter by Squad, Gender, Age Group, Stroke, Status, and Course.
3. Let coaches manage swimmer and QT data directly in the browser — via sync, manual file upload, or inline editing — without needing to hand-edit raw JSON.
4. Keep data sources clear and recoverable: every dataset can be synced, uploaded, downloaded, or cleared independently, with conflict resolution when uploads collide with existing data.
5. Calculate age groups from the actual championship dates in use (QT Editor / synced metadata) rather than a hardcoded seasonal constant — so the dashboard self-corrects each season as soon as new QT data is loaded.
6. When a swimmer isn't visible on a tab, tell the coach why rather than leaving them to wonder — distinguishing a genuine "no PB recorded" from a data problem, an active filter doing its job, or a default state like Former Swimmer.

## What It Is Not

- Not a race results entry tool (that lives in the individual swim-dash, or upstream in the Google Sheet that feeds this dashboard's Sheets sync).
- Not a live data feed — sync is always coach-triggered, never automatic on page load.
- Not multi-user / server-based — data lives in browser `localStorage`; sharing across devices is via Sheets/GitHub sync or downloading and re-uploading JSON files.
- Not a system with per-coach authentication — Sheets sync uses a single shared `ACCESS_TOKEN`, the same for every coach. Storing it in the browser instead of the HTML file keeps it out of the public source, but it is not individual login, and (as of v2.4) it's known to be sent as a URL query parameter rather than a header — see `known-bugs-and-fixes.md`.

## Related Files / Repos

| File | Purpose |
|---|---|
| `index.html` | This project — self-contained, no build step |
| `apps_script_v2.2.1.gs` | Google Apps Script Web App — bound to the club's Google Sheet, unchanged since v2.2.1 |
| `county_qt.json` | County championship qualifying times (`{meta, times}` format), hosted on GitHub for sync |
| `regional_qt.json` | Regional qualifying times (same format), hosted on GitHub for sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — exportable/importable, also sync-able from the Google Sheet |
| `swim-dash/index.html` | Individual swimmer dashboard (separate project, same QT data) |

## Current Version

**v2.4** — a continuation session, July 2026, built on the v2.3 base. No single headline feature this round: a sequence of real bugs (a data-loss merge bug, a stale-timestamp/locale-format bug, an inaccurate diagnostic message, an inaccurate date-range banner) each found via direct testing/user reports and fixed with verified root causes, plus a requested full codebase review that surfaced and closed three genuine stored-XSS vulnerabilities. See `session-log.md` for the full turn-by-turn history and `coach_dashboard_handover.md` for a new-session-ready summary.
