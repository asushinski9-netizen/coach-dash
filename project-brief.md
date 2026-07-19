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
8. **(New, v2.6)** Be defensible against bad/malicious input on every data path (manual upload AND sync), not just the ones that happened to be validated first — and be usable via keyboard/screen reader, not just mouse/touch.

## What It Is Not

- Not a race results entry tool (that lives in the individual swim-dash, or upstream in the Google Sheet that feeds this dashboard's Sheets sync).
- Not a live data feed — sync is always coach-triggered, never automatic on page load.
- Not multi-user / server-based — data lives in browser `localStorage`; sharing across devices is via Sheets/GitHub sync or downloading and re-uploading JSON files.
- Not a system with per-coach authentication — Sheets sync uses a single shared `ACCESS_TOKEN`, sent as a URL query parameter rather than a header (see `known-bugs-and-fixes.md`, Open Issues #1 and #2 — both explicitly reviewed and deliberately left as-is in v2.6; real per-coach auth is a feature, not a fix, and deserves its own session).
- The Overview tab is not a filtered/customizable view — it's deliberately a fixed, whole-squad snapshot (no Squad/Gender filter bar), distinct from the filterable County/Regional tabs.

## Related Files / Repos

| File | Purpose |
|---|---|
| `index.html` | This project — self-contained, no build step |
| `apps_script_v2.2.2.gs` | Google Apps Script Web App — bound to the club's Google Sheet; token-check + `setToken()` hardening in v2.6 |
| `county_qt.json` | County championship qualifying times (`{meta, times}` format), hosted on GitHub for sync |
| `regional_qt.json` | Regional qualifying times (same format), hosted on GitHub for sync |
| `swimmers_pb.json` | Squad swimmer profiles and PBs — exportable/importable, also sync-able from the Google Sheet |
| `swim-dash/index.html` | Individual swimmer dashboard (separate project, same QT data) |
| `test_overview.js` | jsdom dev-time test harness for the Overview tab (v2.5) — not shipped with the dashboard, still passes in full against v2.6 |

## Current Version

**v2.6** — a security/accessibility/code-quality hardening pass, started from two direct mobile bug reports and then a full user-requested codebase review (a 20-item punch list covering security, bugs, UI/accessibility, and code quality — all rolled out), plus one real stored-XSS vulnerability found *while implementing* the review's items (not on the original list): Hot Right Now rendered an unvalidated, unescaped `pb.course` value in a class attribute, bypassing the safe lookup path every other tab uses. Fixed at both the validation and render layers, verified with a dedicated XSS probe. Also added: keyboard/screen-reader support for previously mouse-only UI (clickable cards, chart legends, all four modals now have real dialog semantics and focus management), write-side localStorage protection (previously only reads were guarded), sync-path data validation parity with manual uploads, and GitHub-sync retry-with-backoff. A follow-up turn fixed a mobile-only visibility gap in the Manage Data modal (status/conflict messages hidden below the fold). No data schema changes; no new dependencies. Apps Script bumped to v2.2.2 for its two changes. See `session-log.md` for the full turn-by-turn history and `coach_dashboard_handover.md` for a new-session-ready summary.
