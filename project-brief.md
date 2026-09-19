# Coach Dashboard — Project Brief

## What It Is

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs. It lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times, get a whole-squad "morning briefing" view, and manage all the underlying data (swimmers, QT standards) directly in the browser, with optional sync from Google Sheets and GitHub — plus, as of v2.8, a one-file Backup & Restore covering all of it at once.

It is a companion tool to an existing **individual swimmer dashboard** (`swim-dash`, hosted at `asushinski9-netizen.github.io/swim-dash`) which tracks one swimmer's personal history. The coach dashboard consumes the same QT JSON file formats.

## Who Uses It

**Swimming club coaches** — not individual swimmers or parents. The audience is someone who needs a squad-wide view rather than a single athlete view.

## Core Goals

1. Show every registered swimmer's PBs alongside County and Regional QT/CT thresholds.
2. Group and filter by Squad, Gender, Age Group, Stroke, Status, and Course.
3. Let coaches manage swimmer and QT data directly in the browser — via sync, manual file upload, inline editing, or (as of v2.8) a single full backup/restore — without needing to hand-edit raw JSON.
4. Keep data sources clear and recoverable: every dataset can be synced, uploaded, downloaded, or cleared independently, with conflict resolution when uploads collide with existing data, and everything together can be backed up and rolled back as one unit.
5. Calculate age groups from the actual championship dates in use (QT Editor / synced metadata) rather than a hardcoded seasonal constant.
6. When a swimmer isn't visible on a tab, tell the coach why rather than leaving them to wonder.
7. Give a coach a fast, whole-squad "what's happening right now" view on landing — composition at a glance, who's actively improving, and who's closest to a breakthrough — without needing to dig through County/Regional tabs one swimmer at a time.
8. Be defensible against bad/malicious input on every data path (manual upload, sync, AND restore), not just the ones that happened to be validated first — and be usable via keyboard/screen reader, not just mouse/touch.
9. **(Planned, not yet built — see below)** Let a coach validate manually-tracked PBs against a swimmer's *official* Swim England record, without either data source silently overwriting or displacing the other.

## What It Is Not

- Not a race results entry tool (that lives in the individual swim-dash, or upstream in the Google Sheet that feeds this dashboard's Sheets sync).
- Not a live data feed — sync is always coach-triggered, never automatic on page load. This principle is expected to extend to the planned SE PB import too (see below) — it will be a manual upload action, not a background poll.
- Not multi-user / server-based — data lives in browser `localStorage`; sharing across devices is via Sheets/GitHub sync, downloading and re-uploading individual JSON files, or (as of v2.8) a single full backup/restore bundle.
- Not a system with per-coach authentication — Sheets sync uses a single shared `ACCESS_TOKEN`, sent as a URL query parameter rather than a header (see `known-bugs-and-fixes.md`, Open Issues #1 and #2 — both explicitly reviewed and deliberately left as-is; real per-coach auth is a feature, not a fix, and deserves its own session).
- The Overview tab is not a filtered/customizable view — it's deliberately a fixed, whole-squad snapshot (no Squad/Gender filter bar), distinct from the filterable County/Regional tabs.
- **Not, and will never be, a scraper of Swim England's public results site.** This was tested and explicitly ruled out — see "Next Planned Work" below.
- The v2.8 Backup & Restore is **not** a merge tool — it's Replace-only (per dataset present in the bundle). A coach wanting to combine a backup with current data uses the existing per-source Upload cards' Merge option instead.

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
| `probe_backup_restore.js` | **New (v2.8).** One-off jsdom probe verifying the Backup & Restore feature specifically — not shipped, not merged into `test_overview.js` |
| `se-pb-import-and-history-plan.md` | Full plan for the not-yet-built SE PB report import and PB-history feature — see below |

## Current Version

**v2.8** — Backup & Restore. A single, planned feature session, scoped exactly to `se-pb-import-and-history-plan.md` Section 6: a new "🗄️ Full Backup & Restore" card in the Manage Data modal lets a coach download Swimmers + County QT + Regional QT as one JSON bundle, and restore from one later. Restore is Replace-only per dataset present in the bundle (a bundle missing a piece leaves that piece untouched, rather than being rejected wholesale), validated through the same sanitisers every other upload path already uses, and gated behind an explicit before→after count confirmation. Deliberately excludes the sync URL/token. Fully additive — none of the three existing per-source cards were touched. This was the first of the four sessions in the SE-import roadmap (v2.8–v2.11) and is fully independent of the other three, by design — see `session-log.md` for the full writeup.

## Next Planned Work — start with v2.9

A separate planning conversation (not the v2.8 session) produced a coach-approved plan to let the dashboard import official Swim England PB reports (exported by the coach from their own SE App account, `.xlsx`, one Short Course + one Long Course file) and cross-check them against the manually-tracked gala PBs already in the dashboard, plus a PB-history mechanism built on top of it. Full detail — architecture, matching rules, conflict-handling design, and the locked `mergePbEntry()` spec — lives in **`se-pb-import-and-history-plan.md`**. In short:

- The original idea (auto-scraping each swimmer's public SE results page) was tested and **explicitly ruled out** — Swim England's Website Terms of Use prohibit systematic downloading/database-building from the site, and this is personal data on named individuals (mostly minors) from the sport's governing body. Not a risk-tolerance call; a hard no.
- The unblock: the coach can export the same PB data directly and manually from their own authorised SE App account. That export is the new data source, and its real format has since been confirmed against sample files (see the plan doc).
- The work is split into four separate future sessions, in order:
  - **v2.9 — next up.** SE# field end-to-end: Apps Script reads `"Basic Data"` column E → `se` field in the sync payload → `mergeSwimmers()` carries it through (authoritative when present) → an editable field in Add/Edit Swimmer.
  - **v2.10.** `pbs` schema widening (multiple dated entries per event+course, a new `source` field) + the fully-specced `mergePbEntry()` merge function + a derived "current PB" helper threaded through every existing consumer + Hot Right Now's definition tightened to "recent improvements."
  - **v2.11.** The SE import itself — SheetJS parsing, SE#/name+DOB matching, per-record diffing via `mergePbEntry()`, a conflict review UI, and apply.
- **v2.8 (this version) was deliberately sequenced ahead of all three** as an independent safety net, given v2.9–v2.11 start writing into swimmer data more aggressively than anything before them — see `coach_dashboard_handover.md` for the full handoff.
- **The coach has approved the full SE report import + history mechanism.** Nothing from v2.9–v2.11 has been implemented yet.
