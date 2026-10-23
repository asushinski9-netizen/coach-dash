# Coach Dashboard

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs — see at a glance how every swimmer compares against County and Regional qualifying times, get a whole-squad "morning briefing", manage the data in the browser (sync, upload, backup/restore), keep real PB history per event, and **import the club's official Swim England PB reports to cross-check and correct tracked PBs**.

**Current version: v2.12** (dashboard v2.12.7, Apps Script 2.2.4 build b5). This file is a landing pointer, not the documentation:

| File | What's in it |
|---|---|
| `coach_dashboard_handover.md` | **Start here** when beginning a new session (currently: starting v2.13) |
| `project-brief.md` | What the project is, goals, current version, next planned work |
| `architecture.md` | Code structure, the SE import pipeline, data flow, security notes, testing |
| `data-schema.md` | Persisted schemas, the SE report file format, in-memory import structures, planned changes |
| `known-bugs-and-fixes.md` | Open issues and the fix history by version |
| `session-log.md` | Turn-by-turn history of every session |
| `se-pb-import-and-history-plan.md` | Plan for PB history and the SE import: as-built notes, corrections, proposed roadmap |
| `se-matching-scenarios.md` | Exactly which swimmers auto-match, are suggested, or are skipped |

## Files in this repo
| File | Purpose |
|---|---|
| `index.html` | The dashboard — self-contained, no build step |
| `apps_script_v2.2.4.gs` | Google Apps Script bound to the club's Sheet (Sheets sync): every dated swim, warnings, stats. Deploy: Save, then New version of the existing deployment |
| `county_qt.json` / `regional_qt.json` | Championship qualifying times, hosted here for GitHub sync (**this repo is public**) |
| `swimmers_pb.json` | Swimmer profiles and PBs (exported from the dashboard; not committed by default) |
| `test_overview.js`, `probe_pbs_widening.js`, `probe_se_import.js`, `test_se_import_core.js`, `test_se_matching_matrix.js`, `probe_same_day.js`, `test_apps_script_v224.js`, `probe_stage2.js`, `probe_ids.js`, `probe_dobmatch.js` (+ earlier probes) | Dev-time Node/jsdom tests — not shipped with the dashboard. Need `npm install jsdom`; `test_se_import_core.js` also needs `python3` + `openpyxl` and the real sample exports |
| `se_sample_rows.json`, `arty_rows.json`, `swimmers_pb__3__-_Copy.json` | Test fixtures from real exports. **Contain a child's name, date of birth and SE # — do not commit to the public repo** (known-bugs #16) |
| `user_test_script_v2.12.md` | Coach-facing manual test script (v2.12; v2.9-2.11 scripts kept) |

## Companion project
[`swim-dash`](https://asushinski9-netizen.github.io/swim-dash) — an individual swimmer dashboard consuming the same QT JSON formats.
