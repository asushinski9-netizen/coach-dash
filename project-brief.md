# Coach Dashboard — Project Brief

## What It Is

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs. It lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times, get a whole-squad "morning briefing" view, and manage all the underlying data (swimmers, QT standards) directly in the browser, with optional sync from Google Sheets and GitHub, a one-file Backup & Restore (v2.8), an optional Swim England ID ("SE #") per swimmer (v2.9), and (v2.10) support for real PB history — multiple dated results per event, not just "the current best" — laying the groundwork for the planned official SE PB report import.

It is a companion tool to an existing **individual swimmer dashboard** (`swim-dash`, hosted at `asushinski9-netizen.github.io/swim-dash`) which tracks one swimmer's personal history. The coach dashboard consumes the same QT JSON file formats.

## Who Uses It

**Swimming club coaches** — not individual swimmers or parents.

## Core Goals

1. Show every registered swimmer's PBs alongside County and Regional QT/CT thresholds.
2. Group and filter by Squad, Gender, Age Group, Stroke, Status, and Course.
3. Let coaches manage swimmer and QT data directly in the browser — via sync, manual file upload, inline editing, or a single full backup/restore — without needing to hand-edit raw JSON.
4. Keep data sources clear and recoverable: every dataset can be synced, uploaded, downloaded, or cleared independently, with conflict resolution when uploads collide with existing data.
5. Calculate age groups from the actual championship dates in use rather than a hardcoded seasonal constant.
6. When a swimmer isn't visible on a tab, tell the coach why rather than leaving them to wonder.
7. Give a coach a fast, whole-squad "what's happening right now" view on landing.
8. Be defensible against bad/malicious input on every data path, not just the ones that happened to be validated first.
9. **(v2.10, this version)** Let a swimmer's `pbs` array hold genuine history — more than one dated result per event — without losing any of it to a routine sync or merge, and without flooding the "recent PBs" feed with non-improving swims.
10. **(Planned, not yet built — v2.11)** Let a coach validate manually-tracked PBs against a swimmer's *official* Swim England record, without either data source silently overwriting or displacing the other.

## What It Is Not

- Not a race results entry tool.
- Not a live data feed — sync is always coach-triggered, never automatic on page load.
- Not multi-user / server-based — data lives in browser `localStorage`; sharing across devices is via Sheets/GitHub sync, downloading and re-uploading individual JSON files, or a single full backup/restore bundle.
- Not a system with per-coach authentication (see `known-bugs-and-fixes.md` Open Issues #1/#2).
- The Overview tab is not a filtered/customizable view.
- **Not, and will never be, a scraper of Swim England's public results site** — see `se-pb-import-and-history-plan.md`.
- The v2.8 Backup & Restore is **not** a merge tool — it's Replace-only.
- **v2.10's `mergePbEntry()` is not yet wired into anything a coach can trigger** — it's implemented and tested, ready for v2.11's SE import to call, but has no UI path of its own in this version.

## Related Files / Repos

| File | Purpose |
|---|---|
| `index.html` | This project — self-contained, no build step |
| `apps_script_v2.2.3.gs` | Google Apps Script Web App — unchanged since v2.9 |
| `county_qt.json` / `regional_qt.json` | Championship qualifying times, hosted on GitHub for sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — exportable/importable, also sync-able from the Google Sheet |
| `swim-dash/index.html` | Individual swimmer dashboard (separate project, same QT data) |
| `test_overview.js` | jsdom dev-time test harness for the Overview tab — Section 7's fixture fixed in v2.10 |
| `probe_pbs_widening.js` | **New (v2.10).** Dedicated jsdom probe for the `pbs` widening / `mergePbEntry()` / source-field / merge-bug-fix work |
| `probe_backup_restore.js` | v2.8 probe, unchanged |
| `test_se_field.js` / `probe_se_field.js` | v2.9 probes, unchanged |
| `user_test_script_v2.10.md` | **New (v2.10).** Coach-facing manual test checklist |
| `se-pb-import-and-history-plan.md` | Full plan for the SE PB report import and PB-history mechanism — the locked design this session implemented |

## Current Version

**v2.10** — `pbs` schema widening (multiple dated entries per event+course) + `mergePbEntry()`, scoped exactly to `se-pb-import-and-history-plan.md` Sections 3–4. A new per-PB `source` field (`gala`/`se`/`manual`) defaults to `gala` for all pre-existing data at read time. "Current PB" is now derived by a single, named, always-live helper (`getCurrentPbMap()`) shared by County/Regional and the Bubble List. Hot Right Now is redefined to mean "recent improvements," not every recorded swim. `mergePbEntry()` — the fully-specced, locked merge function intended for v2.11's SE import — is implemented and tested this session, ahead of that caller. **A real production bug, reported directly by the coach, was found and fixed in the same session:** manually-entered PBs for the same event+course were being silently discarded by a routine upload-merge or Google Sheets sync; `mergePbs()` now correctly keys by event+course+date instead of just event+course, so every distinct dated entry survives a merge. `test_overview.js`'s one previously-known pre-existing failure (Open Issue #7, a stale test fixture) was also fixed this session. This was the third of the four sessions in the SE-import roadmap (v2.8–v2.11) and depended only on v2.9's stable swimmer schema. See `session-log.md` for the full writeup.

## Next Planned Work — start with v2.11

A separate planning conversation produced a coach-approved plan to let the dashboard import official Swim England PB reports and cross-check them against the manually-tracked gala PBs already in the dashboard. Full detail lives in **`se-pb-import-and-history-plan.md`**. In short:

- ~~v2.9. SE# field end-to-end~~ — **shipped.**
- ~~v2.10. `pbs` schema widening + `mergePbEntry()`~~ — **shipped, this version.**
- **v2.11 — next up.** The SE import itself: `.xlsx` parsing (SheetJS), block detection by row shape, SE#/name+DOB swimmer matching, per-record diffing via the already-implemented `mergePbEntry()`, a conflict-review UI calling the already-implemented `resolvePbEntryConflict()`, and an apply/summary step. This session's `pbs` widening and merge-function work is the direct dependency v2.11 needed before it could be built sensibly.
- **v2.12 (queued from v2.9's coach UAT).** A dedicated "Swimmers" tab for basic profile data, independent of County/Regional's PB/QT-driven filtering — see `known-bugs-and-fixes.md` Open Issue #9.
- **The coach has approved the full SE report import + history mechanism.** Nothing from v2.11 has been implemented yet — only its two dependencies (v2.9, v2.10) are done.
- **Issue #7 (a stale `test_overview.js` fixture) — fixed in v2.10**, not carried forward as an open item any longer.
