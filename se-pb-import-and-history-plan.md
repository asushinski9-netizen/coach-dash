# Coach Dashboard — SE PB Import & PB History — Plan

**Status: planning only. The coach has approved building the SE PB report upload described in Sections 1–4. Nothing described in this document has been implemented.** This carries forward, in full, a planning conversation that took place in a separate chat from the main development sessions (which have otherwise been mobile-fix/hardening passes — see `session-log.md` v2.6/v2.7). It supersedes nothing in `architecture.md`/`data-schema.md` except where those files explicitly cross-reference it as "planned."

If you're picking this up fresh: read this whole document before writing any code. Several design decisions here exist specifically *because* of a real bug this codebase already shipped and fixed once (`mergeSwimmers()`'s `sourceIsAuthoritative` flag) — repeating that mistake in a new import path would be a regression of a lesson already learned, not a new discovery.

---

## 1. Background — how we got here

The original ask was to pull each swimmer's *official* PB data automatically from Swim England's public results lookup site (`swimmingresults.org/individualbest/personal_best.php?tiref=<SE#>`), using the "SE #" column already present in the coach's Google Sheet ("GALA TIMES", Basic Data tab).

**We tested this and ruled it out.** The page fetched fine (no bot-block), but Swim England's own Website Terms of Use (swimming.org) explicitly prohibit exactly what this would have been: *"create a database by systematically downloading and storing Site content"* and *"use any manual or automatic device in any way to gather Site content... without our express prior written consent."* Given this is personal performance data on named individuals (mostly minors) from the sport's governing body, we treated this as a hard no, not a risk-tolerance judgement call. The ToS also states the correct channel is to contact Swim England directly for "interoperable program" access — that's a path the coach can pursue separately if wanted, but it's not something to build around.

**The unblock:** the coach can export two reports directly from the team's own SE App account — one Short Course PBs report, one Long Course PBs report. This is the coach's own authorised export, so none of the ToS concerns above apply. This became the new data source.

---

## 2. Report format (from screenshots — real sample file still pending, see Section 6)

Each report is a flat sheet with repeating blocks, **not** one row per swimmer:

- **Swimmer header row** (single row, multi-line cell): `Lastname, Firstname:` / `DOB (Category/Gender Age)` / `SE#`
  e.g. `Sushinski, Artyom: / 12/10/2014 (Open/Boy 11) / 1745801`
- **Event rows** underneath: column A (always `"1"` — purpose unknown, likely a leftover, **not** a rank/dedup indicator — needs confirming), event name, time with an `S`/`L` suffix already matching our own course convention (e.g. `33.25S`, `42.02L`), an `F`/`P` flag, date, competition name.
- **F/P = race stage**: `F` = Final, `P` = Prelim/Heat. Confirmed by coach. Both are valid officially-recorded times; this isn't a quality/validity flag, so both should be importable — but see Open Items re: whether to store/display which stage a time came from.
- **Blank-row spacing is inconsistent** — sometimes a blank row separates swimmers, sometimes not; same for event rows. Parser must detect block boundaries by row *shape* (does it look like a swimmer-header row vs an event row), not by blank-row position.

---

## 3. Overall architecture — three independent data sources, not one merged pipeline

Deliberately kept as three separate, simple pieces rather than one complex system, so a problem/change in one doesn't risk the others:

### 3.1 Google Sheet sync ("GALA TIMES") — unchanged

- Still the **only** source that can create a swimmer, and the only source of `name`/`dob`/`gender`/**`squad`**/roster membership.
- Still also the source of gala-recorded PBs, for every swimmer, exactly as today.
- Still fully coach-triggered (never automatic) — this was reconfirmed explicitly in the coach-facing summary.
- **No changes planned to this pathway.**

### 3.2 SE PB Report import — new, this is the feature being built

- **Two files uploaded together in one action** (SC + LC), not two independent upload cards — because a swimmer's SC and LC PBs are two halves of one record and should be matched/merged in a single pass. Either file can be provided alone; both aren't required.
- **This import can only *update times* on swimmers that already exist** (created via 3.1 or manual Add Swimmer). It must **never** create, delete, or hide a swimmer, and must **never** touch `squad`. Two structural reasons force this:
  1. SE reports have no squad field at all.
  2. SE reports only list swimmers who already have a recorded SE time — new joiners, swimmers with no times yet, and anyone without an SE# never appear, so treating this as a full/authoritative snapshot would silently drop real swimmers. (This is the same class of bug as a real v2.2.1 regression in this codebase, where an incomplete import was wrongly treated as authoritative and dropped absent swimmers — `mergeSwimmers()`'s existing `sourceIsAuthoritative` flag exists because of that. The SE import must follow the "not authoritative" path by design, permanently, not as a toggle.)
- **Matching swimmers to report rows:**
  - Primary key going forward: **SE#** (new field to add to the swimmer schema — see `data-schema.md` §9.1).
  - Bootstrap fallback for a swimmer who doesn't yet have SE# stored: match by name + DOB (same normalisation the existing Sheets sync already does), then persist the SE# onto that swimmer record for all future imports.
  - No SE# stored and no name/DOB match found → **do not create a swimmer**. Surface as "N rows couldn't be matched — check spelling/DOB or add them via Add Swimmer first," and skip. Silent ghost-profile creation was explicitly rejected as worse than skipping.
  - Swimmers without an SE# at all simply keep using gala-times PBs, indefinitely, no special handling needed.
- **Conflict handling — this was a specific coach concern, not a nice-to-have:** the coach noted the SE App itself is sometimes missing PBs, so **SE data must not be treated as automatically authoritative over existing dashboard data**. Design:
  - No existing PB for that event/course → add automatically, no conflict.
  - Existing PB identical (same time + date) → no-op.
  - Existing PB differs → **do not auto-resolve.** Surface a review list (swimmer, event, course, existing value + where it came from, incoming SE value) and let the coach decide per-row/per-swimmer, rather than one global Replace/Merge switch (the pattern used for QT/swimmer file uploads elsewhere in the app isn't granular enough here).
  - This implies **each PB entry should carry its own provenance** (`gala` / `se` / `manual`) rather than relying on the existing swimmer-level `source` field alone — needed so the conflict-review UI can actually say where each competing value came from. See `data-schema.md` §9.2.
- **Framed to the coach as a validation tool, not just a data feed** — "lets you validate your manually-entered GALA TIMES against official SE data," which is the actual value proposition that got the go-ahead, distinct from "SE data replaces your data."
- **Technical note:** files are `.xlsx`. The dashboard currently only parses JSON uploads — this will need SheetJS (the `xlsx` library, CDN-loaded) to read spreadsheet rows before the block-parsing logic runs.
- **Still fully coach-triggered**, same as everything else — reconfirmed in the coach-facing summary as a general principle across all three data sources.

### 3.3 QT sync (County/Regional) — unrelated, unchanged

Not part of this discussion at all, mentioned only to confirm it's untouched.

---

## 4. Backup & Restore — planned, sequenced *after* the SE import schema lands

Currently, a full backup means downloading three separate files (Swimmers / County QT / Regional QT) independently — fine for single-source backup, awkward for "move to a new device."

**Proposed (not yet built):**

- Dedicated "💾 Backup & Restore" modal/menu entry, separate from the existing per-source Manage Data cards.
- **Download Full Backup** → single JSON bundle of `SWIMMERS` + `COUNTY_QT`(+meta) + `REGIONAL_QT`(+meta), with a `{version, generated, ...}` header matching the convention already used by the Apps Script payload and QT files.
- **Restore Full Backup** → **Replace-only**, not merge, with an explicit confirmation stating exactly what counts will be overwritten. Reasoning: a full backup claims to be a complete snapshot, so merge semantics don't make sense here the way they do for genuinely-partial imports (a single QT file, a single SE report) — offering merge would just add a confusing half-supported path.
- **Deliberately excluded from the bundle:** `coach_SYNC_URL`/`coach_SYNC_TOKEN` — these are per-browser credentials, not squad data; bundling a secret token into a shareable backup file was flagged as a real footgun to avoid by design.
- **Optional/lower-priority to include:** theme, Overview day-cutoff/margin% preferences.
- **Sequencing decision:** build this *after* the SE-import schema changes (new `SE#` field, per-PB `source` tag) land, so the backup format is designed once against the final schema rather than needing revision immediately after.

---

## 5. PB progression / history tracking — not yet designed

A newer ask, raised at the end of the planning conversation, **not yet designed in any detail**:

> If a PB on upload/entry/sync already exists for a date prior, it should become historical rather than just overwritten — i.e. track PB *progression* over time, not just the current best.

This needs a proper design pass, considering **every entry point that can introduce a PB**, since each currently just keeps "the fastest time" and discards anything about prior bests:

- Manual Add/Edit Swimmer (`saveSwimmer()`)
- Google Sheets sync (`mergeSwimmers()` → `mergePbs()`)
- The new SE PB report import (once built)
- The QT editor is unrelated (that's standards, not swimmer PBs) — not in scope here

**Things to think through in that design (not decided yet):**

- Data shape: does each PB entry become a small history array/list rather than a single `{time, date}`, with "current PB" derived as the fastest (or most recent-fastest) entry? Needs to stay compatible with every existing consumer of `sw.pbs` (`buildSwimmerRows`, Hot Right Now's `collectRecentPbs`, the Bubble List, CSV/JSON export, etc.) — a schema change here touches a lot of surface area, per `data-schema.md`'s existing PB entry shape.
- **Deduplication**: the same historical swim shouldn't get re-recorded every time (e.g. a gala sync re-imports the same old PB row every week — that shouldn't create a duplicate history entry each time). Needs a stable identity for "is this the same swim I've already recorded" — likely time+date+event+course+competition, but needs confirming.
- **Cross-source consistency**: if the SE import and the gala sync both eventually see the same historical swim, do we still want just one history entry, tagged with which source(s) confirmed it? Ties into the per-PB `source` field already proposed in Section 3.2.
- **What "current" means for a given event/course** stays the same concept as today (fastest recorded) — the change is *retaining* what it used to be before it improved, not changing which one counts as the active PB for status/QT comparisons.
- **UI implications**: Overview's Hot Right Now already shows "recent PBs" — would it show progression (e.g. "improved by 0.4s") once history exists? Not decided, just flagged as a likely follow-on ask once the data exists.

**Recommended sequencing:** do not attempt this opportunistically alongside the SE import (Section 3.2). It's a materially bigger, cross-cutting schema change that deserves its own dedicated design session once the SE-import fields (`se`, per-PB `source`) have already landed and are stable — designing both at once risks getting neither right.

---

## 6. Open items / things still needed before implementation can start

1. **A real sample SE report file** (even redacted/small) — coach said they'd provide "shortly," not yet received. Needed to confirm exact column layout/types before building the parser, rather than working from screenshots alone. **Blocking** — do not start parser implementation without this; a screenshot-derived parser is a real risk of building against a format that doesn't quite match reality (merged cells, whitespace, encoding, etc. don't show up in a screenshot).
2. **Confirm column A is always exactly `"1"`** with never more than one row per event per swimmer in these reports — if there's any chance of duplicates, the parser should defensively take the fastest (mirroring existing `mergePbs()` behaviour) rather than trust it blindly.
3. **Former Swimmer / hidden swimmer handling**: should an SE-report row that matches a Former/hidden swimmer be skipped by default (with a note), given the dashboard's overall Former-Swimmer-hidden-by-default posture? Raised, not yet answered.
4. **Whether to store/display race stage (F/P)** anywhere in the dashboard, or just use it as an "is this a valid time" pass-through (both currently treated as valid).
5. **The PB-history design itself** (Section 5) — needs its own dedicated design pass covering all entry points before any schema change is made.

---

## 7. Coach communication so far

The coach has been kept in the loop with a plain-language (non-technical) summary covering: the three-source architecture, why the SE import layers on top of gala sync rather than replacing it (squad + missing-swimmers gaps), the conflict-flagging behaviour (frames the import as a validation tool, not a silent overwrite), the planned single-file backup/restore, and a one-line note on why automatic scraping of the public SE results site was ruled out. **Coach has approved building the SE report upload mechanism.** PB history/progression tracking has not yet been communicated to the coach — that's a newer, internal-only ask so far.

---

## 8. Suggested build order (not yet started — proposed only)

Not committed to, but a reasonable sequence given the dependencies above:

1. Get the real sample SE report file (Section 6, item 1) — **hard blocker** on everything below.
2. Add SheetJS (CDN) and confirm `.xlsx` files can be read into rows at all, against the real sample.
3. Build the block parser (swimmer-header detection vs event-row detection by row shape, not blank-row position) against the real sample; confirm the column-A-is-always-"1" assumption (item 2) empirically rather than trusting it.
4. Add the `se` swimmer field and per-PB `source` field to the schema (`data-schema.md` §9.1/§9.2), including the "existing PB entries default to `source: 'gala'`" migration decision.
5. Build SE#-then-name/DOB matching, with the "skip + report" behaviour for unmatched rows (never create a ghost swimmer).
6. Build the no-conflict / identical / differs-so-review-it three-way PB comparison, and the per-row conflict review UI.
7. Wire the two-file (SC + LC) upload UI, framed as a validation tool per Section 3.2.
8. Only then: Backup & Restore (Section 4), once the schema from steps 4–6 is stable.
9. PB history/progression (Section 5) is a separate, later design-and-build pass — not part of this sequence.

Each step should get its own verification pass (this codebase's standing convention — see `architecture.md`'s Testing section) rather than being built end-to-end and tested once at the finish.
