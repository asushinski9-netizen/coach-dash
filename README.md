# Coach Dashboard

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs — lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times, get a whole-squad "morning briefing" view, and manage all the underlying data directly in the browser.

**Current version: v2.6.** This file is intentionally short — it's a landing pointer, not the project documentation. See:

| File | What's in it |
|---|---|
| `project-brief.md` | What the project is, who it's for, core goals, current version summary |
| `architecture.md` | Code structure, data flow, key business logic, security notes |
| `data-schema.md` | All JSON schemas (swimmer profiles, QT data, Sheet structure, localStorage keys) |
| `known-bugs-and-fixes.md` | Open issues and the full fix history by version |
| `session-log.md` | Turn-by-turn history of every development session |
| `coach_dashboard_handover.md` | Executive summary written for starting a fresh chat session |

## Files in this repo

| File | Purpose |
|---|---|
| `index.html` | The dashboard itself — self-contained, no build step |
| `apps_script_v2.2.2.gs` | Google Apps Script Web App bound to the club's Google Sheet (Sheets sync) |
| `county_qt.json` / `regional_qt.json` | Championship qualifying times (`{meta, times}` format), hosted here for GitHub sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — not committed here by default (contains the actual squad's data); exportable/importable from the dashboard itself |
| `test_overview.js` | jsdom dev-time test harness for the Overview tab — not shipped with the dashboard |

## Companion project

[`swim-dash`](https://asushinski9-netizen.github.io/swim-dash) — an individual swimmer dashboard tracking one swimmer's personal history, consuming the same QT JSON file formats.
