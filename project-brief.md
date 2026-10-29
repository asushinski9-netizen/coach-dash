# Coach Dashboard — Project Brief

## What It Is
A fully self-contained, single-HTML-file coaching dashboard for swimming clubs. It shows, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times, gives a whole-squad "morning briefing", and lets the coach manage all the underlying data in the browser — with optional sync from Google Sheets and GitHub, a one-file Backup & Restore (v2.8), a Swim England ID per swimmer (v2.9), real PB history (v2.10) import of the club's official Swim England PB reports (v2.11), and, new in v2.12, a Google Sheet feed that carries **every dated swim** (heats and finals) with typo, skipped-row and stale-deployment warnings.

It is a companion to an individual swimmer dashboard (`swim-dash`, `asushinski9-netizen.github.io/swim-dash`), which consumes the same QT JSON formats.

## Who Uses It
Swimming club **coaches** — not swimmers or parents.

## Core Goals
1. Show every swimmer's PBs beside County and Regional QT/CT thresholds.
2. Group and filter by Squad, Gender, Age Group, Stroke, Status and Course.
3. Let coaches manage swimmer and QT data in the browser (sync, upload, inline edit, backup/restore).
4. Keep every dataset recoverable, with conflict handling when sources collide.
5. Calculate age groups from the actual championship dates.
6. Tell the coach *why* a swimmer is not visible.
7. Give a fast whole-squad "what's happening now" view.
8. Defend every data path against bad or malicious input.
9. Let `pbs` hold genuine history without losing any of it to a routine merge (v2.10).
10. **(v2.11)** Let the coach validate and correct manually tracked PBs against the *official* SE record — without either source silently overwriting the other, and with the coach in control of every identity match and every conflicting time.
11. **(Done in v2.12)** The Google Sheet feed carries full dated history; a swimmer is the same swimmer across a corrected date of birth; data is never deleted automatically on a sync.
12. **(Planned, v2.13–v2.14)** Swimmers and Data tabs, then progression insights built on the full history.

## What It Is Not
- Not a race-results entry tool; not a live feed (sync/import are always coach-triggered); not multi-user or server-based (data is in `localStorage`; sharing is by Sheets/GitHub sync, JSON files, or a backup bundle); no per-coach authentication (known-bugs #1/#2).
- **Not, and will never be, a scraper of Swim England's public results site** — the SE import reads the coach's own exported `.xlsx` files only.
- The SE import is **a forward-accumulating feed, not a history backfill**: the report format only shows each swimmer's current best, so history builds up by importing repeatedly.
- It never creates, deletes or hides a swimmer, never changes squad, name or date of birth.
- Backup & Restore is Replace-only (restoring an old bundle loses later work, including imports).

## Related Files / Repos
| File | Purpose |
|---|---|
| `index.html` | This project — self-contained, no build step |
| `apps_script_v2.2.3.gs` | Apps Script Web App for Sheets sync — **to be replaced in v2.12** (full dated history) |
| `county_qt.json` / `regional_qt.json` | QT data, hosted on GitHub for sync (the repo is **public**) |
| `swimmers_pb.json` | Exportable/importable swimmer profiles and PBs |
| `swim-dash/index.html` | Individual swimmer dashboard (separate project) |
| `se-pb-import-and-history-plan.md` | Plan, as-built notes, proposed roadmap |
| `se-matching-scenarios.md` | Exactly how the SE import matches swimmers (auto / suggested / skipped) |
| `test_*.js`, `probe_*.js`, fixtures | Dev-time tests (see `architecture.md`); fixtures contain personal data, keep private |
| `user_test_script_v2.11.md` | Coach manual test script (UAT passed) |

## Current Version
**v2.12** (dashboard v2.12.11; Apps Script 2.2.4 build b5) — every dated swim from the Sheet (heat + final kept as two swims), unusually-fast / skipped-row / orphaned-swim reports, a build check for the deployed script, sync retry and clear errors, a shared name key with a collision stop, guaranteed-unique swimmer ids, DOB-aware matching, SE-import DOB hints. 644 automated checks passing; coach UAT passed. See `session-log.md`.

## Next Planned Work — read `coach_dashboard_handover.md` first
- **v2.13 "Tabs"**: dedicated Swimmers tab (known-bugs #9) and a Data tab; candidates: filter footer counts (#20), a redesigned sync message (#23), System Settings / maintenance mode (#27), a merge-duplicates tool, acknowledging warnings (#14).
- **Before v2.14**: rename the `pbs` field (known-bugs #19).
- **v2.14 "Progression"**: the visual progression / all-results view, built on the full history.
