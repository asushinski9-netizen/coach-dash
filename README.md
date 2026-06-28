# Coach Dashboard — Project Brief

## What It Is

A fully self-contained, single-HTML-file coaching dashboard for swimming clubs. It lets a coach see, at a glance, how every swimmer in the squad compares against County and Regional championship qualifying times — and manages all the underlying QT data directly in the browser.

It is a companion tool to an existing **individual swimmer dashboard** (`swim-dash`, hosted at `asushinski9-netizen.github.io/swim-dash`) which tracks one swimmer's personal history. The coach dashboard consumes the same QT JSON file formats.

## Who Uses It

**Swimming club coaches** — not individual swimmers or parents. The audience is someone who needs a squad-wide view rather than a single athlete view.

## Core Goals

1. Show every registered swimmer's PBs alongside County and Regional QT/CT thresholds.
2. Group and filter by Squad, Gender, Age Group, Stroke, Status, and Course.
3. Let coaches manage QT time data directly in the browser without needing to edit raw JSON.
4. Export data as JSON files that can be committed to version control for multi-device use.

## What It Is Not

- Not a race results entry tool (that lives in the individual swim-dash).
- Not a live data feed — all data is manually entered or uploaded.
- Not multi-user / server-based — data lives in browser localStorage; sharing requires downloading and re-uploading JSON files.

## Related Files / Repos

| File | Purpose |
|---|---|
| `coach_dashboard.html` | This project — self-contained, no build step |
| `county_qt.json` | County championship qualifying times (new wrapped format: `{meta, times}`) |
| `regional_qt.json` | Regional qualifying times (same format; previously `se_london_qt.json`) |
| `swimmers_pb.json` | Squad swimmer profiles and PBs |
