# Coach Dashboard — Data Schemas (v2.5)

**No schema changes in v2.5.** The entire session was scoped to the new Overview tab, which reads the existing `SWIMMERS`/`COUNTY_QT`/`REGIONAL_QT` in-memory structures only — no new fields, no new files, no new localStorage keys. All shapes below are unchanged from v2.4.

---

## 1. Swimmer Profile (`coach_SWIMMERS` in localStorage / `swimmers_pb.json` export)

```json
[
  {
    "id":     "sw_001",
    "name":   "Alex Smith",
    "dob":    "2012-04-15",
    "gender": "Boys",
    "squad":  "Junior",
    "source": "sheet",
    "hidden": false,
    "pbs": [
      {
        "event":       "100 Back",
        "course":      "S",
        "time":        "1:22.80",
        "date":        "2025-11-15",
        "competition": "Watford SC County Qualifier 2025"
      }
    ]
  }
]
```

### Root object fields

| Field | Type | Required | Values / Notes |
|---|---|---|---|
| `id` | string | yes | `"sw_"` prefix + timestamp for manual; `"sh_"` prefix + sanitised name for Sheet-sourced |
| `name` | string | yes | Full display name — `Firstname Lastname` format |
| `dob` | string | yes | ISO 8601 `YYYY-MM-DD` — used for age bracket calculation (County/Regional tabs) AND for plain calendar age (Overview tab's Squad Composition, v2.5 — see `architecture.md`) |
| `gender` | string | yes | `"Boys"` or `"Girls"` — must match QT data exactly |
| `squad` | string | no | See squad values below; omit if unassigned |
| `source` | string | no | `"sheet"` or `"local"` — set by Sheets sync; omitted for pre-v2.2 manual entries |
| `hidden` | boolean | no | `true` = excluded from all renders by default; can be included in the Overview tab's Bubble List via its "Include hidden / Former Swimmers" toggle, tagged with why |
| `pbs` | array | yes | Array of PB entry objects; can be empty `[]` |

### Squad values

| Value | Badge colour | Overview tab chart color (v2.5) |
|---|---|---|
| `"Development"` | Teal | `#0891b2` |
| `"Junior"` | Blue | `#4f86d8` |
| `"Senior"` | Purple | `#7c3aed` |
| `"Active"` | Green | `#059669` |
| `"Masters"` | Amber | `#d97706` |
| `"Former Swimmer"` | Grey — hidden by default | Excluded from Overview by default; includable via Bubble List's toggle |
| *(omitted)* | No badge shown | Grouped as "No Squad" in the Overview's By Squad chart |

### PB entry object

| Field | Type | Required | Values / Notes |
|---|---|---|---|
| `event` | string | yes | Must match an entry in `ALL_EVENTS`. Split into `{distance, stroke}` by the Overview tab's `splitEventDistance()` (v2.5) for its compact entry rows and mobile stroke abbreviations |
| `course` | string | yes | `"S"` = Short Course 25m · `"L"` = Long Course 50m |
| `time` | string | yes | `"mm:ss.hh"` or `"ss.hh"` |
| `date` | string | no | ISO 8601 `YYYY-MM-DD`. **v2.5:** PBs with no `date` are excluded from the Overview tab's Hot Right Now feed (undated entries can't be placed in a chronological list) |
| `competition` | string | no | Name of meet where PB was set |

### Manual upload validation (`sanitiseSwimmersData`)

Unchanged from v2.4 — validates `name`, `dob`, `gender`, and PB `time` format; drops invalid PB entries silently with a console warning; does not validate/regenerate `id`; Sheets sync bypasses this validator entirely (see `known-bugs-and-fixes.md` Open Issue #7).

---

## 2. QT Data Files (`county_qt.json` / `regional_qt.json`)

Unchanged from v2.4 — `{meta: {title, dateFrom, dateTo}, times: [...]}`, legacy plain-array format still accepted via `parseQTFull()`. See `architecture.md` for how `meta.dateFrom`/`dateTo` drive age brackets and the championship-date banner (County/Regional tabs only — the Overview tab's Squad Composition deliberately does not depend on QT metadata being present).

### `times` entry fields

| Field | Type | Values / Notes |
|---|---|---|
| `gender` | string | `"Boys"` or `"Girls"` |
| `course` | string | `"Short Course"` or `"Long Course"` |
| `event` | string | Must match `ALL_EVENTS` |
| `age` | string | County: `"10+11"` `"12"`–`"16"` `"17+"` · Regional: `"11/12"` `"13"`–`"17"` `"18+"` |
| `qualify` | number\|null | Qualifying time in seconds. `null` = not offered |
| `consider` | number\|null | Consideration time in seconds. `null` = not offered |

No manual-upload validation exists for this file type (Open Issue #7).

### GitHub sync source

```
https://raw.githubusercontent.com/asushinski9-netizen/coach-dash/main/county_qt.json
https://raw.githubusercontent.com/asushinski9-netizen/coach-dash/main/regional_qt.json
```

---

## 3. Event Strings (`ALL_EVENTS`)

```
50 Free   100 Free   200 Free   400 Free   800 Free   1500 Free
50 Back   100 Back   200 Back
50 Breast 100 Breast 200 Breast
50 Fly    100 Fly    200 Fly
100 IM    200 IM     400 IM
```

**v2.5 addition (display-only, not a schema change):** `splitEventDistance(event)` splits any of the above into `{distance, stroke}` (e.g. `"50 Free"` → `{distance: "50", stroke: "Free"}`), and `STROKE_ABBR`/`STROKE_COLOR` map the stroke to a mobile abbreviation (`FR`/`BK`/`BR`/`FLY`/`IM`) and an accent color respectively. These are presentation-layer constants in `index.html`, not part of any stored data shape.

---

## 4. Google Sheet Structure (unchanged since v2.2)

**Sheet ID:** `17cPbJgykqF7JHcWUPS4HoYASCG14A7cwug5k0D_M9DM`

### "Basic Data" tab
Rows 1–2: headers. Data from row 3.

| Col | Content | Format |
|---|---|---|
| A | Swimmer Full Name | `LASTNAME, FIRSTNAME` |
| B | Gender | `M` or `F` |
| C | Date of Birth | `DD/MM/YYYY` |
| D | Squad | Free text — normalised via `SQUAD_MAP` |

### "Results" tab
Row 1: header. Data from row 2.

| Col | Content | Notes |
|---|---|---|
| B | Swimmer Full Name | Matches Basic Data format |
| C | Gender | M or F |
| D | Event | See event abbreviations below |
| E | Date | DD/MM/YYYY |
| F | Course | `SC` or `LC` |
| G+ | Split/cumulative pairs | Each 50m = 2 cols: (split seconds, cumulative mm:ss.hh) |

**DQ detection:** Yellow background on swimmer name cell (col B). Hex values checked: `#ffff00`, `#fff2cc`, `#ffe599`, `#ffd966`.

**Final cumulative column per event:**

| Event | Distance | Final col index (0-based) | Letter |
|---|---|---|---|
| 50m | 1 split | 7 | H |
| 100m | 2 splits | 9 | J |
| 200m | 4 splits | 13 | N |
| 400m | 8 splits | 21 | V |
| 800m | 16 splits | 37 | AL |
| 1500m | 30 splits | 65 | BN |

Formula: `index = 6 + (distance/50 × 2) − 1`

### Event abbreviation mapping (Sheet → dashboard)

| Sheet | Dashboard | Sheet | Dashboard |
|---|---|---|---|
| 50 FS | 50 Free | 50 BRST | 50 Breast |
| 100 FS | 100 Free | 100 BRST | 100 Breast |
| 200 FS | 200 Free | 200 BRST | 200 Breast |
| 400 FS | 400 Free | 50 FLY | 50 Fly |
| 800 FS | 800 Free | 100 FLY | 100 Fly |
| 1500 FS | 1500 Free | 200 FLY | 200 Fly |
| 50 BK | 50 Back | 100 IM | 100 IM |
| 100 BK | 100 Back | 200 IM | 200 IM |
| 200 BK | 200 Back | 400 IM | 400 IM |

---

## 5. Apps Script Payload (unchanged since v2.2)

```json
{
  "version":   "2.2",
  "generated": "2026-06-26T11:54:10.419Z",
  "count":     62,
  "swimmers":  [ ...swimmer objects... ]
}
```

Fetched by `startSync()` as `GET ${syncUrl}?token=${token}` — token is a URL query parameter, not a header (Open Issue #1, still unresolved as of v2.5).

---

## 6. localStorage Key Map

**No new keys in v2.5.** The Overview tab's own state (chart-toggle exclusions, per-card expand/collapse, show-all/fewer, day cutoff, margin %) is session-only — held in JS variables and DOM input values, never written to `localStorage`. See `known-bugs-and-fixes.md` Open Issue #8.

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_COUNTY_QT` / `coach_REGIONAL_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+ |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` / `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared by all coaches |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | |
| `coach_COUNTY_QT_LAST_SYNC` / `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub | |

---

## 7. Course Code Convention

| Context | Short Course | Long Course |
|---|---|---|
| Swimmer PBs (`course` field) | `"S"` | `"L"` |
| QT data (`course` field) | `"Short Course"` | `"Long Course"` |
| Sheet (`course` field) | `"SC"` | `"LC"` |
| UI badge | `SC` | `LC` |

---

## 8. Time Format Convention

| Context | Format |
|---|---|
| Swimmer PBs (JSON) | `"mm:ss.hh"` or `"ss.hh"` string |
| QT times (JSON) | Float seconds |
| QT editor inputs | `"mm:ss.hh"` or `"ss.hh"` |
| Sync/last-updated timestamps (UI) | `"DD/MM/YYYY, HH:MM"` 24hr, via `fmtDateTime()` |
| Overview tab dates (v2.5) | `"D MMM"` (no year) via `fmtDateShort()` — used only where space is tight (Hot Right Now's compact entry rows); every other date display in the app still uses the full `fmtDate()` |
| Sheet Results tab cumulative | `"mm:ss.hh"` string |
| Sheet Results tab splits | Float seconds |

Conversion functions: `timeToSec("1:22.80")` → `82.80` · `secToTime(82.80)` → `"1:22.80"` · `fmtDate(iso)` → `"15 Nov 2025"` · `fmtDateShort(iso)` → `"15 Nov"` (v2.5) · `fmtDateTime(iso)` → `"01/07/2026, 12:43"`
