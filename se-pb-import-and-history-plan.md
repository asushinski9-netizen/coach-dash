# Coach Dashboard — SE PB Import & PB History — Plan (v2, September 2026)

**Status: planning only. Nothing described in this document has been implemented.** This supersedes the June 2026 version of this document. That version's background (Sections 1, 2's ToS reasoning) is carried forward unchanged below; everything about report format, PB-history design, and sequencing has been substantially revised following a planning session that reviewed the real sample `.xlsx` files and worked through the PB-history question in detail. If picking this up fresh: read this whole document before writing any code.

---

## 1. Background — how we got here (unchanged from v1)

The original ask was to pull each swimmer's *official* PB data automatically from Swim England's public results lookup site, using the "SE #" column in the coach's Google Sheet. **This was tested and ruled out** — Swim England's Website Terms of Use explicitly prohibit systematic downloading/database-building from the site, and this is personal performance data on named individuals (mostly minors) from the sport's governing body. Not a risk-tolerance call — a hard no.

**The unblock:** the coach exports two reports directly from the team's own SE App account — one Short Course PBs report, one Long Course PBs report. This is the coach's own authorised export, so none of the ToS concerns apply.

---

## 2. Report format — confirmed against real sample files

Real sample files (`ALL_COMPETITIVE_SHORT_COURSE`, `ALL_COMPETITIVE_LONG_COURSE`) have been reviewed directly. This replaces the v1 plan's screenshot-derived guesses with confirmed structure:

- Single sheet per file (named `"Top Times(0)"` in the samples — **do not hardcode this name**; read the first sheet and validate its header row shape instead, since a different report configuration could name it differently).
- Header row: `Rank | Event | Best Time | P/F/T | Date | Meet Name`. No merged cells.
- **Swimmer-header row is a single cell, single line, no embedded newlines**: `"Lastname, Firstname: DD/MM/YYYY  (Gender Age) SE#"` — e.g. `"Baker, Bob: 18/10/2013  (Boy 12) 1234567"`. Note: **no category prefix** (the v1 plan's screenshot-derived guess of `"Open/Boy 11"` was wrong — the real format is just `"(Gender Age)"`). Two spaces between the DOB and the opening parenthesis. Gender token is singular (`Boy`/`Girl`) — maps to the dashboard's `"Boys"`/`"Girls"`.
- **Column A ("Rank") is always `"1"`** — this is not a mystery field (v1's open item #2, now resolved): it's genuinely the Rank column, always 1 because this is a *Top Times* report — only the current best per event is ever exported. Defensively still take-the-fastest if a future export ever has >1 row per event, but not expected.
- **Blank-row spacing is genuinely inconsistent, confirmed empirically, including *within* a single swimmer's own block** (e.g. one swimmer has no blank row between two consecutive events, but does between others). **Block detection must be by row shape, never by blank-row position**: a header row has column B empty and column A matching the name/DOB/SE# pattern; an event row has a numeric Rank in column A and a recognised event name in column B; an all-blank row is an ignorable separator.
- Event names match `ALL_EVENTS` **exactly** — no abbreviation-mapping table needed (unlike the Google Sheet's `EVENT_MAP`).
- Time format: `"36.97S"` / `"1:26.25S"` — numeric time + single-letter course suffix (`S`/`L`), matching the dashboard's existing convention exactly. Each file is course-homogeneous (SC file only has `S` suffixes, LC only `L`), so the suffix is redundant confirmation, not the only signal.
- Dates are `DD/MM/YYYY`, need conversion to ISO `YYYY-MM-DD`.
- **`P/F/T` column (race stage) — decided: ignore entirely.** Not stored, not surfaced anywhere. (Resolves v1's open item #4.)
- **Meet/competition names are hard-truncated at exactly 30 characters** by SE's own export — confirmed empirically (every truncated name in both sample files is exactly 30 chars, none exceed it). **Decision: a truncated SE competition string never overwrites an existing fuller `competition` value on a matched record; it's only used when writing a genuinely new record.**

---

## 3. PB progression history — now integrated into this plan, not a separate later ask

The v1 plan treated PB history as a vague, deliberately-undesigned follow-on (its old Section 5). Following a design conversation, it is now a required part of the SE import's core mechanism, not a separate feature — the sections below replace v1 Section 5 entirely.

### 3.1 The key realization: snapshot diffing, not one-shot capture

A single SE "Top Times" export is current-best-only — it cannot, by itself, backfill history that's since been superseded. But a **sequence** of these snapshots, diffed against what's already stored, does incrementally build real history going forward: day 1's import seeds one dated point per event/course; if a gala happens and the swimmer improves, day 15's import brings a new dated best, which — diffed against what's already stored — is genuine new historical information, not just an update to "the current number."

**This means the record identity for diffing must be `event + course + date`, not `event + course` alone.** That's a materially different (and more granular) key than the dashboard's current one-entry-per-event-course model.

### 3.2 What this means for the data source landscape

- **The SE report structurally cannot backfill history in one shot** — it only ever has room for the current best per event/course on any given pull. Day-1 import only ever seeds **one** historical point per event/course (whatever is officially best *right now*) — anything the swimmer swam and was later beaten by isn't visible to this report format, ever. **Set this expectation with the coach explicitly**: this is not a backfill of years of history, it's a forward-accumulating feed from the point of first import onward.
- **Google Sheets/gala sync could, in principle, be a much richer history source** — the underlying "Results" tab has every meet result the club has ever recorded, but `apps_script_v2.2.2.gs`'s `buildPayload()` currently **collapses to only the fastest time per event+course before it's ever exported** (`if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec)`). Getting full historical richness from gala data requires rewriting the Apps Script to emit every dated result — a real, separable, second-file change (its own deployment, its own testing). **Explicitly deferred** — not required for the core mechanism to work. Gala sync can keep sending "current best per event+course" exactly as it does today and still get diffed against stored history the same way SE import does.
- **Manual Add/Edit Swimmer** can already supply arbitrary historical results (a coach can type in an old meet time at any point) — naturally compatible with the widened schema below with no UI redesign required for this phase.

### 3.3 Schema decision

- **`sw.pbs` keeps its field name** — not renamed to `results`/`history`. Only what it's allowed to *hold* changes: **multiple dated entries per event+course, instead of exactly one.** Keeping the name unchanged means every existing export, backup, and the Apps Script payload shape stays valid with zero migration step — "one entry per event+course" is just a degenerate case of "many."
- **New field per PB entry: `source`** — `"gala"` / `"se"` / `"manual"`. A PB entry with no `source` (all pre-existing data) is treated as `"gala"` at read time via a small helper — no mass backfill-write pass needed.
- **"Current PB" and "was this a PB when it was set" are *never* stored — always recomputed live** by scanning the full `pbs` array for that event+course. Rationale: historical entries can now arrive out of chronological order (SE import backfills one dated point on day 1; a coach might later manually add an older result from years earlier) — a stored flag would go stale the moment an earlier-dated record is added afterward, and nothing would automatically re-derive it unless explicitly coded to. Recomputing avoids an entire class of staleness bugs; at squad scale (tens to low hundreds of swimmers, a handful of results each) the extra computation is irrelevant.
- **No visible change to County/Regional tabs** in this round of work — they keep reading derived current-best exactly as today.
- **Hot Right Now's definition needs to tighten** once the array can hold non-PB historical swims too: it should mean "recent *improvements*" (entries that were a PB at the time), not every recorded swim, or the feed would flood with non-PB noise. This is a required adjustment when the schema lands, not optional polish.
- **The visual "Progression" tab is explicitly deferred** — swim-dash's live site (`asushinski9-netizen.github.io/swim-dash`) was reviewed directly as the reference model: its "📈 Progression" tab and "📋 All Results" table both work off one array of every individual result, with "PB?" and "Δ Prev" as *derived* columns computed by scanning that array in date order. That's the right pattern to borrow eventually, but the data model needs to be correct first — the pretty UI on top can follow a step behind with nothing wrong in the meantime.

---

## 4. The `mergePbEntry()` merge function — full spec, agreed and locked

This is the one function everything else depends on — used by SE import from day one, and intended to be re-pointed under Sheets sync's existing merge path later if/when the Apps Script full-history rewrite ships. One definition of "same swim," used everywhere, rather than several drifting apart across import paths.

**Identity key: `event + course + date`.** Deliberately *not* including `time` — two sources disagreeing about the time for the same real swim is exactly what should raise a conflict, not fragment into a fake extra record.

**Inputs:**
- `existingPbs` — a swimmer's current `pbs` array (widened schema, multiple entries per event+course allowed)
- `incoming` — one candidate record: `{ event, course, date, time, competition, source }`

**Outcomes:**

| Case | Condition | Result |
|---|---|---|
| **Add** | No existing entry matches event+course+date | Auto-appended, tagged with the incoming `source`. **No coach review** — reported only in a final summary count. |
| **No-op** | An existing entry matches event+course+date **and** time | Nothing changes — **including `source`, even if the incoming record's source differs from the one already stored.** A source tag is sticky; it only ever changes via an actual conflict-resolved overwrite (see below), never silently on a matching no-op. |
| **Conflict** | An existing entry matches event+course+date, but `time` differs | Surfaced for a **per-record** coach decision — never auto-resolved either direction. Resolving as "keep existing" → nothing changes. Resolving as "use incoming" → **full straight replacement**: time, `source`, and competition (respecting the truncation-preference rule below) all update to the incoming values. No partial-supersede/retain-history mechanism yet — that's part of the later Progression-era work, not this phase. |

**Competition/venue handling (not part of identity):** on an "add," or on a conflict resolved as "use incoming," the incoming `competition` string only overwrites/sets the stored value if the stored value is empty, or the incoming value is *not* a truncated fragment of a fuller existing value (per the 30-char SE truncation finding in Section 2). Otherwise the existing competition text is kept even if the time itself updates.

**Explicitly out of scope for this function:**
- Swimmer matching (SE#/name+DOB fallback) — happens one layer up, before `mergePbEntry()` is ever called; it only ever runs once a swimmer is already confirmed matched.
- Current-PB derivation, cross-event summarisation, or any squad-wide view — purely the caller's responsibility, always computed live per Section 3.3.

---

## 5. SE# — new swimmer field, now confirmed end-to-end

- **Google Sheet column confirmed: `"Basic Data"` tab, column E, header `"SE #"`** (alongside existing A=Swimmer name, B=Sex, C=DOB, D=Squad). Screenshot-verified.
- `apps_script_v2.2.2.gs`'s `buildPayload()` needs to read column E and include an `se` field on each swimmer in the payload.
- `mergeSwimmers()` needs to carry `se` through from Sheet sync — treated as **authoritative** when present, same trust level as `name`/`dob`/`gender` today (not merge-with-review; the coach's own maintained roster field).
- **Conflict worth a soft warning, not a hard block:** if a swimmer already has an `se` value (e.g. previously backfilled by the SE-import name+DOB fallback) and a Sheet sync brings a *different* SE# for the same swimmer, that's a real data-quality signal (typo, or an earlier fallback-match error) — surface it, don't silently pick one.
- Add/Edit Swimmer UI needs an editable, optional SE# field (validated as a non-empty digit string when present, no fixed length enforced — real sample SE#s vary from 7 to 8 digits).
- **Matching logic for SE import itself is unchanged from v1**: SE# first, name+DOB fallback (persisting the SE# onto the matched record for future imports), skip-and-report if neither matches — never ghost-create a swimmer.

---

## 6. Backup & Restore — resequenced to build *first*

v1 sequenced this after the SE-import schema landed, reasoning it should be "designed once against the final shape." **Revised**: the bundle format doesn't actually interpret the swimmer schema at all — it just snapshots `SWIMMERS` / `COUNTY_QT`(+meta) / `REGIONAL_QT`(+meta) verbatim, and on restore runs each piece through its *existing* sanitiser exactly like the per-source upload flow already does. It's schema-agnostic by construction, so it doesn't need to wait — and given the next two pieces of work start writing into swimmer data more aggressively than anything before them, having this safety net in place *first* is the right call.

- **Additive to the existing per-source Download/Upload/Clear cards, not a replacement** — those still earn their keep independently (e.g. sharing just `county_qt.json` on GitHub for swim-dash to also consume).
- Format: single JSON bundle, `{version, generated, swimmers, countyQt: {meta, times}, regionalQt: {meta, times}}` — matching conventions already used elsewhere (`{version, generated, count, swimmers}` from the Apps Script payload; `{meta, times}` from the QT files).
- Restore is **Replace-only**, with an explicit confirmation stating exactly what will be overwritten (counts per dataset).
- **Deliberately excludes `coach_SYNC_URL`/`coach_SYNC_TOKEN`** — per-browser credentials, not squad data; bundling a secret token into a shareable backup file would be a real footgun.

---

## 7. Phased build order — four versions, four sessions

Given the scope above, this is being built as four separate versions, each in its own chat session (not just separate version numbers within one long conversation) — keeps context focused per session and keeps each session's doc updates (`architecture.md`, `data-schema.md`, `known-bugs-and-fixes.md`, `session-log.md`) accurate to what's actually shipped at that point, rather than describing several versions' worth of change as one lump.

| Version | Scope | Depends on |
|---|---|---|
| **v2.8** | Backup & Restore (Section 6) | Nothing — fully independent |
| **v2.9** | SE# field end-to-end (Section 5) — Apps Script column read, payload, `mergeSwimmers()`, Add/Edit Swimmer UI | Nothing — independent of the merge function and SE import |
| **v2.10** | `pbs` schema widening + `source` field + `mergePbEntry()` implementation (Section 4) + derived current-PB helper threaded through `buildSwimmerRows`, Hot Right Now, Bubble List, `sanitiseSwimmersData` + Hot Right Now's "recent improvements" redefinition | v2.9 (for a stable swimmer schema to build against) |
| **v2.11** | SE import itself: SheetJS read → block parser (row-shape based, Section 2) → SE#/name+DOB matching → per-record diff via `mergePbEntry()` → conflict review UI → apply → summary | v2.9 + v2.10 |

**v2.10 gets its own dedicated `test_overview.js` regression pass before anything is layered on top of it** — it has real surface area across the existing app (not just new code), matching the project's standing convention of verifying each step rather than testing everything once at the end.

**The `mergePbEntry()` spec in Section 4 is already fully agreed and locked** — it was deliberately settled as pure design ahead of any of the four sessions above, so v2.10 and v2.11 build against an already-agreed contract rather than one improvised mid-session.

---

## 8. Explicitly deferred / out of scope for v2.8–v2.11

- **Apps Script rewrite to emit every Results-tab row** (not just fastest-per-event+course) — real, separable, future work; would enrich gala-sourced history but isn't required for the core mechanism (Section 3.2).
- **The visual Progression/history-browsing tab** (swim-dash-style charts + all-results table with derived Δ-vs-previous) — the data model needs to be correct now; the UI on top can follow later.
- **Any "supersede but retain" richer conflict-resolution** beyond straight replacement (Section 4) — needs its own design pass once there's a reason to keep a superseded-but-since-corrected value visible.
- Everything already carried forward as unchanged/untouched from before this planning session: per-coach sync auth, the `doPost`/header token fix, and the other pre-existing Open Issues in `known-bugs-and-fixes.md`.

---

## 9. Coach communication notes

- Coach has approved the SE PB report upload mechanism (carried from v1) and, in this session, the PB-history mechanism built on top of it, the SE# field, and the phased v2.8–v2.11 build order.
- **Set expectations explicitly before v2.11 ships**: SE import's contribution to history is forward-accumulating from first import onward, not a backfill of the swimmer's full competitive past — the report format structurally cannot see anything a swimmer's current best has since superseded.
