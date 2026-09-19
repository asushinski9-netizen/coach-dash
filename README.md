# Coach Dashboard

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs — lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times, get a whole-squad "morning briefing" view, and manage all the underlying data directly in the browser, including a one-file backup and restore.

**Current version: v2.8.** This file is intentionally short — it's a landing pointer, not the project documentation. See:

| File | What's in it |
|---|---|
| `project-brief.md` | What the project is, who it's for, core goals, current version summary, and next planned work |
| `architecture.md` | Code structure, data flow, key business logic, security notes |
| `data-schema.md` | All JSON schemas (swimmer profiles, QT data, Sheet structure, localStorage keys, the v2.8 backup bundle format) — plus a clearly-marked "planned, not yet implemented" section for the SE import work |
| `known-bugs-and-fixes.md` | Open issues and the full fix/feature history by version |
| `session-log.md` | Turn-by-turn history of every development session |
| `se-pb-import-and-history-plan.md` | Full plan for the not-yet-built Swim England PB report import and PB-history feature — queued as v2.9–v2.11 |
| `coach_dashboard_handover.md` | Executive summary written for starting the next session (v2.9) |

## Files in this repo

| File | Purpose |
|---|---|
| `index.html` | The dashboard itself — self-contained, no build step |
| `apps_script_v2.2.2.gs` | Google Apps Script Web App bound to the club's Google Sheet (Sheets sync) |
| `county_qt.json` / `regional_qt.json` | Championship qualifying times (`{meta, times}` format), hosted here for GitHub sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — not committed here by default (contains the actual squad's data); exportable/importable from the dashboard itself |
| `test_overview.js` | jsdom dev-time test harness for the Overview tab — not shipped with the dashboard |
| `probe_backup_restore.js` | jsdom probe verifying the v2.8 Backup & Restore feature — not shipped with the dashboard |

## Companion project

[`swim-dash`](https://asushinski9-netizen.github.io/swim-dash) — an individual swimmer dashboard tracking one swimmer's personal history, consuming the same QT JSON file formats.
