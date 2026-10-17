# Coach Dashboard — Data Schemas (v2.11)

**v2.11 changes no persisted schema.** The swimmer root object and PB entry are exactly as in v2.10. What is new: `source: "se"` (reserved in v2.10) is now *written* — by the SE PB Report Import — and several in-memory structures used by the import are documented in Section 12 (they are never saved). The Apps Script payload is unchanged (still `version "2.3"`); a change to it is planned for v2.12 (Section 10). Section 11 documents the SE report file format the importer reads.

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
    "se":     "1234567",
    "pbs": [
      { "event": "100 Back", "course": "S", "time": "1:24.80", "date": "2025-06-01",
        "competition": "City of St Albans Spring Meet 2025", "source": "manual" },
      { "event": "100 Back", "course": "S", "time": "1:22.80", "date": "2025-11-15",
        "competition": "Watford SC County Qualifier 2025", "source": "gala" },
      { "event": "100 Back", "course": "S", "time": "1:22.10", "date": "2026-05-17",
        "competition": "WSC Claire Houchin Skills Deve", "source": "se" }
    ]
  }
]
```
(Placeholder identities — use synthetic data in docs and tests; see known-bugs #16.)

### Root object fields

| Field | Type | Required | Values / Notes |
|---|---|---|---|
| `id` | string | yes | `"sw_"` + timestamp for manual; `"sh_"` + sanitised name for Sheet-sourced. Not validated by the sanitiser (open issue #5) |
| `name` | string | yes | `Firstname Lastname`. The SE importer **never changes it** |
| `dob` | string | yes | ISO `YYYY-MM-DD`. **Never written by the SE import**; used both for age brackets and as the safety anchor when matching |
| `gender` | string | yes | `"Boys"`/`"Girls"` exactly. Never written by the SE import |
| `squad` | string | no | See squad values. Never written by the SE import |
| `se` | string | no | Swim England ID, digits only (`/^\d+$/`), no fixed length (7 and 8 digits seen). Authoritative from a Sheets sync; **the SE import fills it in only where it is blank** (after the match is applied/confirmed); manual Upload-Merge never touches it |
| `source` | string | no | `"sheet"`/`"local"` — how the *swimmer record* originated. **Not the same as a PB entry's `source`** |
| `hidden` | boolean | no | Excluded from renders by default. The SE import matches hidden/Former swimmers like any other and never changes this flag |
| `pbs` | array | yes | May be `[]`; may hold several entries per event+course (v2.10) |

Squad values and colours are unchanged from v2.10 (Development, Junior, Senior, Active, Masters, Former Swimmer; omitted = "No Squad").

### 1.1 PB entry object

| Field | Type | Required | Values / Notes |
|---|---|---|---|
| `event` | string | yes | Must be in `ALL_EVENTS` (enforced per entry by the sanitiser) |
| `course` | string | yes | `"S"` 25 m / `"L"` 50 m |
| `time` | string | yes | `"mm:ss.hh"` or `"ss.hh"` (SE's `"1:26.25S"` suffix is stripped on import) |
| `date` | string | no | ISO. Undated entries cannot appear in Hot Right Now; the SE import *requires* a valid date (an undated SE row is skipped) |
| `competition` | string | no | Free text. From the SE report it is the report's meet name — **hard-truncated at 30 characters in many SE exports but not all** (a 36-character name exists in real data), so never assume a length. `mergeCompetitionField()` only treats an incoming value as truncated if it is exactly 30 characters and a prefix of a longer stored value |
| `source` | string | no | `"gala"` (Google Sheets sync; also the read-time default for any entry without the field, via `getPbSource()`), `"manual"` (Add/Edit Swimmer), `"se"` (**SE PB Report Import, written since v2.11**). Validated against these three values; an invalid value drops just the field |

**Several entries per event+course are normal.** "Current PB" is the fastest across the array, recomputed live (`getCurrentPbMap`); "was an improvement" is `computePbImprovements`. **Record identity for merging is `event + course + date`** (never time).

**How `source: "se"` is treated by the merge code (v2.11):**
- `mergePbEntry()` (the SE import's merge): `noop` keeps the stored `source` (sticky); a conflict resolved as "Use SE report" replaces time/source/competition.
- `mergePbs()` (Google Sheets sync and manual Upload-Merge): an `"se"` entry is never overwritten by a different time on the same event+course+date, and a Sheet row with the same event+course+time on a different date is not re-added when nothing is on file under its own date. Both are counted and reported. Entries of any other source follow the original "keep the faster time" rule.

### Validation (`sanitiseSwimmersData`)
Used by upload, sync, backup restore **and the SE import's apply step**. Drops the whole swimmer for a bad `name`/`dob`/`gender`; drops just a PB for a bad `time`/`event`/`course`; drops just the field for a bad `date`, `se` or PB `source`. Returns `{ clean, skipped, datesDropped, seDropped, pbSourceDropped }`. It does not deduplicate PBs by event+course.

---

## 2. QT Data Files (`county_qt.json` / `regional_qt.json`)
Unchanged: `{meta:{title,dateFrom,dateTo}, times:[{gender,course,event,age,qualify,consider}]}` (legacy plain array still accepted via `parseQTFull`). Age strings — County `10+11, 12…16, 17+`; Regional `11/12, 13…17, 18+`. Validated by `sanitiseQTData`. GitHub sync URLs unchanged.

## 3. Event Strings (`ALL_EVENTS`)
`50/100/200/400/800/1500 Free`, `50/100/200 Back`, `50/100/200 Breast`, `50/100/200 Fly`, `100/200/400 IM`. Unchanged.

## 4. Google Sheet Structure (unchanged since v2.9)
(The Apps Script is bound to the club's Sheet, so no Sheet ID is stored in the dashboard; unchanged.) "Basic Data": A name, B M/F, C DOB (DD/MM/YYYY), D squad, E "SE #". "Results": one row per swim with cumulative split columns; DQ rows are yellow-filled and skipped. **Important for v2.12:** the Apps Script reads every Results row but keeps only the fastest per swimmer+event+course (Section 10).

## 5. Apps Script Payload (unchanged — `version "2.3"`)
```json
{ "version": "2.3", "generated": "…", "count": 62, "swimmers": [ { "id","name","dob","gender","source","pbs":[{event,course,time,date}], "squad"?, "se"? } ] }
```
PB entries carry no `source` (treated as `gala`). Because of the collapse above, `pbs` has **at most one entry per event+course**.

## 6. localStorage Key Map
No new key in v2.11. `coach_SWIMMERS`, `coach_COUNTY_QT_FULL`, `coach_REGIONAL_QT_FULL` (+ legacy keys), `coach_theme`, `coach_SYNC_URL`, `coach_SYNC_TOKEN`, `coach_SHEETS_LAST_SYNC`, `coach_COUNTY_QT_LAST_SYNC`, `coach_REGIONAL_QT_LAST_SYNC`, `coach_HOT_CUTOFF_DAYS`, `coach_BUBBLE_MARGIN` — unchanged. A cancelled "Remove" sync writes nothing (and does not update `coach_SHEETS_LAST_SYNC`). The import wizard's state is in memory only.

## 7. Course Code Convention / 8. Time Format Convention
Unchanged. `S`/`L`; times `mm:ss.hh` or `ss.hh`; SE's trailing course letter is parsed then removed.

## 9. Backup Bundle Format
Unchanged since v2.8: `{ version:"coach-dashboard-backup-1", generated, swimmers, countyQt:{meta,times}, regionalQt:{meta,times} }`, Replace-only, excludes sync URL/token. **Verified (not assumed) that it needs no change for `source:"se"`.**

---

## 10. PLANNED, NOT IMPLEMENTED — v2.12 (scope confirmed; design questions still open; see `se-pb-import-and-history-plan.md` Section 7)

**Apps Script full dated history.** Today's collapse (`if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec)` in `buildPayload()`) means a slower later swim is never synced and two swims before a sync yield only the faster. Proposal: a new script version emits **every** non-DQ Results row as a dated entry (payload `version` bump, e.g. `"2.4"`), keeping the old shape readable. The dashboard side needs no schema change (`pbs` already holds many dated entries; `mergePbs` already keys by event+course+date; Hot Right Now is improvements-only). Questions to settle first: same-day heat/final identity, how far back to import, payload size/quota, handling of obvious Sheet typos, DQ handling. This is a prerequisite for the planned progression tab.

Nothing else in the persisted schema is planned to change.

---

## 11. SE report file format (input; not persisted)

One `.xlsx` per course (Top Times report from the club's SE App account); first sheet only; sheet name irrelevant.

```
Rank | Event | Best Time | P/F/T | Date       | Meet Name                       <- header row, validated
Baker, Bob: 18/10/2013  (Boy 12) 1234567                                         <- swimmer header (one cell)
1    | 50 Free | 36.97S  | F     | 17/05/2026 | WSC Claire Houchin Skills Deve  <- event row
```
- Swimmer header: `Surname, Forename: DD/MM/YYYY  (` *optional `Category/` segments* `Boy|Girl Age) [SE#]`. Seen: `(Boy 12)` and `(Open/Boy 12)`. Age is parsed but unused (the dashboard computes its own). SE # is optional in the parser (a missing one means matching relies on name + DOB).
- Event row: Rank digits (always `1`), event in `ALL_EVENTS`, time `m:ss.hh`/`ss.hh` + `S|L`, `P/F/T` ignored, date `DD/MM/YYYY` (calendar-validated), meet name free text (kept verbatim, escaped on display).
- Blank rows are ignored wherever they fall; block membership is by row shape only.
- A file with both `S` and `L` times, a wrong header row, or no swimmers is rejected as a whole; individual bad rows are skipped and listed (all of them, not a capped sample).

## 12. In-memory structures used by the import (never saved)

```js
// parseSeSheetRows -> swimmers[]
{ surname, forename, fullName, dob /*ISO*/, gender /*Boys|Girls*/, ageLabel, se?, headerRow,
  entries: [{ event, course, time, date, competition?, row }] }

// matchSeSwimmer -> match
{ status: 'matched-se'|'matched-name'|'confirm'|'ambiguous'|'unmatched',
  swimmer?, confidence?: 'high'|'low', reason, nameDiffers?, candidates? }

// wizard entry (one per SE swimmer), _seImport.matches[i]
{ se, match, duplicates: [{ entry, existingMatch }], _accepted?, _dupChoice?: { [entryIdx]: 'skip'|'replace'|'separate' } }

// seComputeOutcomes(m) -> per-entry
{ entry, outcome: 'add'|'noop'|'conflict'|'dup-skip', incoming?, existingEntry?, index?, replacedExisting? }

// apply summary
{ added, datesCorrected, unchanged, duplicatesSkipped, conflictsKept, conflictsUpdated,
  seBackfilled[], skipped[{name, reason}], saveOk }
// invariant: added + datesCorrected + unchanged + duplicatesSkipped + conflictsKept + conflictsUpdated = results in the file
```
