# Coach Dashboard — Data Schemas (v2.3)

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
| `dob` | string | yes | ISO 8601 `YYYY-MM-DD` — used only for age bracket calculation |
| `gender` | string | yes | `"Boys"` or `"Girls"` — must match QT data exactly |
| `squad` | string | no | See squad values below; omit if unassigned |
| `source` | string | no | `"sheet"` or `"local"` — set by Sheets sync; omitted for pre-v2.2 manual entries |
| `hidden` | boolean | no | `true` = excluded from all renders; set by sync merge mode "hide" |
| `pbs` | array | yes | Array of PB entry objects; can be empty `[]` |

### Squad values

| Value | Badge colour |
|---|---|
| `"Development"` | Teal |
| `"Junior"` | Blue |
| `"Senior"` | Purple |
| `"Active"` | Green |
| `"Masters"` | Amber |
| `"Former Swimmer"` | Grey |
| *(omitted)* | No badge shown |

### PB entry object

| Field | Type | Required | Values / Notes |
|---|---|---|---|
| `event` | string | yes | Must match an entry in `ALL_EVENTS` |
| `course` | string | yes | `"S"` = Short Course 25m · `"L"` = Long Course 50m |
| `time` | string | yes | `"mm:ss.hh"` or `"ss.hh"` — e.g. `"1:22.80"` or `"34.50"` |
| `date` | string | no | ISO 8601 `YYYY-MM-DD` |
| `competition` | string | no | Name of meet where PB was set |

If a swimmer has multiple entries for the same `event + course`, `buildSwimmerRows` uses the fastest (minimum seconds). Only one row per event+course shown.

### Manual upload validation (`sanitiseSwimmersData`)

On manual file upload, each swimmer record is validated before being accepted:
- `name` must be a non-empty string
- `dob` must match `YYYY-MM-DD` and parse to a valid date
- `gender` must be exactly `"Boys"` or `"Girls"`
- Any PB entry whose `time` doesn't match `^(\d{1,2}:)?\d{1,2}\.\d{2}$` is dropped silently
- Records failing the above are skipped (not the whole file); a console warning reports the skip count

---

## 2. QT Data Files (`county_qt.json` / `regional_qt.json`)

### Format (v1.0+) — recommended

```json
{
  "meta": {
    "title":    "Hertfordshire County Championships 2026",
    "dateFrom": "2026-02-15",
    "dateTo":   "2026-02-17"
  },
  "times": [
    {
      "gender":   "Boys",
      "course":   "Short Course",
      "event":    "50 Back",
      "age":      "12",
      "qualify":  38.10,
      "consider": 40.80
    }
  ]
}
```

**`meta.dateFrom` / `meta.dateTo` now drive Age Group calculation dashboard-wide** (see `architecture.md` → Championship Dates). This is the only source of championship date information as of v2.3 — there is no hardcoded fallback constant in the dashboard.

### Legacy format (still accepted)

```json
[ { "gender": "Boys", "course": "Short Course", "event": "50 Back", "age": "12", "qualify": 38.10, "consider": 40.80 } ]
```

`parseQTFull()` auto-detects. Legacy load sets empty meta — meaning Age Groups won't resolve until dates are added manually via the QT Editor's ✏️ Edit Details form.

### `times` entry fields

| Field | Type | Values / Notes |
|---|---|---|
| `gender` | string | `"Boys"` or `"Girls"` |
| `course` | string | `"Short Course"` or `"Long Course"` (full words — unlike swimmer `"S"`/`"L"`) |
| `event` | string | Must match `ALL_EVENTS` |
| `age` | string | County: `"10+11"` `"12"`–`"16"` `"17+"` · Regional: `"11/12"` `"13"`–`"17"` `"18+"` |
| `qualify` | number\|null | Qualifying time in **seconds** (float). `null` = not offered |
| `consider` | number\|null | Consideration time in **seconds** (float). `null` = not offered |

`qualify` should be ≤ `consider` (faster). Both null = not offered for this age. Code normalises inverted values defensively but source data should still be correct — the previously-known inverted rows in `county_qt.json` (Girls/17+/SC/200 IM, Girls/16/LC/1500 Free) have been fixed at source.

### GitHub sync source (v2.3)

`county_qt.json` / `regional_qt.json` are hosted at:
```
https://raw.githubusercontent.com/asushinski9-netizen/coach-dash/main/county_qt.json
https://raw.githubusercontent.com/asushinski9-netizen/coach-dash/main/regional_qt.json
```
Pulled via the 🔄 Sync from GitHub button on each QT card in 📤 Manage Data. Manual trigger only — no auto-fetch on page load.

---

## 3. Event Strings (`ALL_EVENTS`)

```
50 Free   100 Free   200 Free   400 Free   800 Free   1500 Free
50 Back   100 Back   200 Back
50 Breast 100 Breast 200 Breast
50 Fly    100 Fly    200 Fly
100 IM    200 IM     400 IM
```

`100 IM` does not appear in either QT file — PBs are stored but no QT comparison is shown for it.

---

## 4. Google Sheet Structure (unchanged in v2.3)

**Sheet ID:** `17cPbJgykqF7JHcWUPS4HoYASCG14A7cwug5k0D_M9DM`

### "Basic Data" tab
- Rows 1–2: headers
- Data from row 3

| Col | Content | Format |
|---|---|---|
| A | Swimmer Full Name | `LASTNAME, FIRSTNAME` |
| B | Gender | `M` or `F` |
| C | Date of Birth | `DD/MM/YYYY` |
| D | Squad | Free text — normalised via `SQUAD_MAP` |

### "Results" tab
- Row 1: header
- Data from row 2

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

| Sheet | Dashboard |
|---|---|
| 50 FS | 50 Free |
| 100 FS | 100 Free |
| 200 FS | 200 Free |
| 400 FS | 400 Free |
| 800 FS | 800 Free |
| 1500 FS | 1500 Free |
| 50 BK | 50 Back |
| 100 BK | 100 Back |
| 200 BK | 200 Back |
| 50 BRST | 50 Breast |
| 100 BRST | 100 Breast |
| 200 BRST | 200 Breast |
| 50 FLY | 50 Fly |
| 100 FLY | 100 Fly |
| 200 FLY | 200 Fly |
| 100 IM | 100 IM |
| 200 IM | 200 IM |
| 400 IM | 400 IM |

---

## 5. Apps Script Payload (unchanged in v2.3)

```json
{
  "version":   "2.2",
  "generated": "2026-06-26T11:54:10.419Z",
  "count":     62,
  "swimmers":  [ ...swimmer objects... ]
}
```

Dashboard unwraps `payload.swimmers` — handles both plain array and wrapped format.

---

## 6. localStorage Key Map

| Key | Format | Written by | Notes |
|---|---|---|---|
| `coach_SWIMMERS` | JSON array | startSync, applySwimmersUpload, saveSwimmer, deleteSwimmer, clearData | User-authoritative |
| `coach_COUNTY_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_REGIONAL_QT_FULL` | `{meta,times}` JSON | saveQTToStorage | |
| `coach_COUNTY_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+ |
| `coach_REGIONAL_QT` | Plain array | *(legacy read-only fallback)* | Never written in v2+ |
| `coach_theme` | `'light'`/`'dark'` | toggleTheme | |
| `coach_SYNC_URL` | string | saveSettings, startSync | Apps Script Web App URL — shared by all coaches |
| `coach_SYNC_TOKEN` | string | saveSettings, startSync | Shared secret token |
| `coach_SHEETS_LAST_SYNC` | ISO timestamp | startSync | Cleared by clearData('swimmers'/'all') |
| `coach_COUNTY_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub('county') | New in v2.3; cleared by clearData('county'/'all') |
| `coach_REGIONAL_QT_LAST_SYNC` | ISO timestamp | syncQTFromGitHub('regional') | New in v2.3; cleared by clearData('regional'/'all') |

---

## 7. Course Code Convention

| Context | Short Course | Long Course |
|---|---|---|
| Swimmer PBs (`course` field) | `"S"` | `"L"` |
| QT data (`course` field) | `"Short Course"` | `"Long Course"` |
| Sheet (`course` field) | `"SC"` | `"LC"` |
| UI badge | `SC` | `LC` |

`lookupQT` converts `"S"` → `"Short Course"` and `"L"` → `"Long Course"` before matching.

---

## 8. Time Format Convention

| Context | Format |
|---|---|
| Swimmer PBs (JSON) | `"mm:ss.hh"` or `"ss.hh"` string |
| QT times (JSON) | Float seconds — e.g. `38.10` |
| QT editor inputs | `"mm:ss.hh"` or `"ss.hh"` (converted via `secToTime`/`timeToSec`) |
| Sheet Results tab cumulative | `"mm:ss.hh"` string — parsed by `parseTimeStr()` in Apps Script |
| Sheet Results tab splits | Float seconds |

Conversion functions: `timeToSec("1:22.80")` → `82.80` · `secToTime(82.80)` → `"1:22.80"`
