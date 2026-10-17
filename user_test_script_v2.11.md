# Coach Dashboard v2.11 — User Test Script

A step-by-step manual checklist for a coach (no dev tools needed) to confirm the new SE PB
Report Import actually works, before trusting it with real data. This is separate from — and
doesn't replace — the automated `test_se_import_core.js`/`probe_se_import.js` checks, which
verify the underlying code logic but not what you actually see and click.

**What this session covers:** importing your club's official Swim England Top Times report(s)
(.xlsx) and cross-checking them against the PBs already in the dashboard. Everything else —
Add/Edit Swimmer, Google Sheets sync, Backup & Restore, County/Regional — works exactly as
before and isn't covered again here.

**Before you start, read this once:** this import is a **forward-accumulating feed**, not a
backfill. Each time you run it, it adds whatever the SE report currently shows as each
swimmer's official best — it can't see, and can't bring in, any swim that's since been beaten
and dropped off the report. It also **never creates, removes, or hides a swimmer, and never
changes anyone's Squad** — it only adds or reconciles PB times (and, where it helps future
imports, fills in a missing SE # once you've confirmed a match).

Tick each box as you go. If anything doesn't match the "Expected" column, stop and tell me
exactly which step failed and what you saw instead — that's much faster to fix than "it's not
working."

---

## Part 0 — Before you start

- [ ] **0.1** You're viewing the v2.11 `index.html` file (check the browser tab title says
      "Coach Dashboard v2.11", or the page `<title>` if you check "View Page Source").
- [ ] **0.2** Download a fresh backup first: **📤 Manage Data → 🗄️ Full Backup & Restore →
      ⬇ Download Full Backup**. Not expected to be needed, but this is new, data-writing
      functionality, so a safety net first is the right habit.
- [ ] **0.3** Have your two real SE Top Times exports ready (one Short Course, one Long
      Course `.xlsx`), or just one of them if that's all you have to hand.

---

## Part 1 — Finding and opening the import

- [ ] Open **📤 Manage Data**. Scroll down — there's a new card: **🏁 SE PB Report Import**.
- [ ] Read the card's description.
- **Expected:** It plainly states this never creates/removes/hides a swimmer, never touches
      Squad, and is a forward-accumulating feed, not a backfill.
- [ ] Click **📥 Import SE PB Report**.
- **Expected:** A new, larger modal opens with a file picker. The Manage Data modal underneath
      is replaced by this one (not stacked confusingly).

---

## Part 2 — Choosing files

### 2.1 Choose just one file
- [ ] Click the file field, choose just your Short Course (or Long Course) export.
- **Expected:** After a brief "⏳ Reading file(s)…" moment, you're taken to a review screen
      showing counts of matched/suggested/unmatched swimmers from that one file.
- [ ] Click **Cancel** to back out.

### 2.2 Choose both files together
- [ ] Reopen the import. This time select **both** your SC and LC files together (most file
      pickers let you Ctrl/Cmd-click or Shift-click both).
- **Expected:** Both are read, and the review screen reflects results combined across both —
      a swimmer appearing in both files should only appear once in the review, with both
      course's times available to it.

### 2.3 Choose two files of the same course by mistake
- [ ] Reopen the import. If you have two SC exports (or just reselect the same SC file twice,
      if your file picker allows it), try selecting both.
- **Expected:** A clear error message naming the problem (e.g. "Both files are Short Course
      reports") rather than a silent or confusing failure. Nothing is imported.
- [ ] Cancel and reopen with a correct file selection before continuing.

---

## Part 3 — The review screen

Using a real export with swimmers who are already in your dashboard roster:

### 3.1 Summary counts
- **Expected:** Near the top, you see badge counts: how many were auto-matched, how many need
      your review, and (if relevant) how many are ambiguous or unmatched.

### 3.2 A swimmer who already has their SE # on file
- [ ] Find a swimmer in the review who already has an SE # saved in the dashboard (check via
      ✏️ Edit on their card beforehand if you're not sure).
- **Expected:** They appear under the auto-matched count — no confirmation needed from you for
      this swimmer specifically.
- [ ] Expand the "N swimmer(s) auto-matched (click to review)" details box.
- **Expected:** Every auto-matched swimmer is listed by name, with how they were matched (SE #
      or name + date of birth). If the SE report's own name for them differs at all from your
      roster (e.g. a nickname on your side vs. a full legal name on SE's side), that's called
      out right there — this import never silently merges a name difference without showing it
      to you, even when nothing needs your confirmation to proceed.

### 3.3 A swimmer whose name differs slightly between your sheet and SE's report
This is the "Arty Sushinski" vs "Artyom Sushinski" situation — a nickname or short form in your
Google Sheet / local records vs. the SE report's full legal name. **What you see depends on
whether the dashboard already holds that swimmer's SE #** (a swimmer's SE # is the strongest
signal the importer has, so it outranks a name difference):

**3.3a — the swimmer already has the SE # on the dashboard (e.g. synced from your Google Sheet)**
- [ ] Find such a swimmer in the review.
- **Expected:** They are **auto-matched** (counted under "auto-matched", no tick needed). Open the
      "N swimmer(s) auto-matched (click to review)" box: the swimmer is listed with a gold note
      showing what the SE report calls them, e.g. `Arty Sushinski (SE report says "Artyom
      Sushinski") - matched via SE #`. The name on your dashboard is never changed.
- **Note:** this is *not* a suggested match. A differing first name alone never turns an SE #
      match into a suggestion.

**3.3 (variant) — the swimmer has NO SE # on the dashboard yet**
- [ ] Remove their SE # (✏️ Edit, clear the SE # field, Save) and run the import again. If you
      don't have a real example, a close-but-not-identical name (a short form, or a middle name on
      one side only) with the same date of birth and gender works too.
- **Expected:** They appear as a **suggested match**, not auto-applied — with a checkbox, the
      two names shown side by side, and a short reason (e.g. "first names look like the same
      person"). It is **not** silently merged for you.

**When else does a swimmer appear under Suggested matches?** Today the main triggers are: the SE #
matches but the date of birth or gender does not; the name and date of birth match but the
dashboard holds a *different* SE #; or the surname, date of birth and gender match but the first
name differs and there is no SE # link. The full list of scenarios (and which ones auto-match or
stay unmatched) is in `se-matching-scenarios.md`. The suggested-match rules are due to be
revisited in v2.12.

- [ ] Before ticking anything, read the short line above the suggested-matches list.
- **Expected:** It states that ticking imports PB times into that swimmer's record and never
      changes their Name, Date of Birth, Gender, or SE #. **Known wording inaccuracy (logged for
      v2.12):** if the swimmer has *no* SE # on the dashboard, confirming a match does fill it in
      from the SE report (the summary says "SE # added for ..."). The text will be corrected.
- [ ] Tick the checkbox to confirm the match.
- **Expected:** Ticking it is clearly reflected in the review (the row visually shows as
      accepted), and the screen does **not** jump back to the top — you stay roughly where you
      were, so you can keep working down a long list without losing your place.
- [ ] Scroll down **inside** the Time conflicts list (it has its own scroll area), then click
      **Keep existing / Use SE report** on a row part-way down. Do the same inside Probable
      duplicates with its radio options and its **Skip all / Replace all / Import all
      separately** buttons, and inside Suggested matches with a tick box.
- **Expected:** The list you were working in stays exactly where it was — it does not jump back
      to its first row. The numbers at the bottom still update.
- [ ] Open one or two of the "click for detail" boxes (e.g. "auto-matched", "will be added"),
      scroll inside one, then click a radio or tick box elsewhere.
- **Expected:** The boxes you opened stay open and keep their scroll position. A box you left
      closed stays closed.

### 3.3b A swimmer with a mismatched SE # already on file
If you have (or can set up) a swimmer who shares a surname, date of birth, and gender with
someone in the SE report, but whose first name differs **and** who already has a different
(wrong, or unrelated) SE # saved in the dashboard:
- **Expected:** They still appear as a **suggested match** — not dropped to "unmatched" just
      because of the existing number — with the mismatch spelled out in the reason text (e.g.
      "this roster swimmer already has a different SE # (xxxxxxx) on file — double-check before
      confirming, in case that number is the one that's wrong").

### 3.4 A swimmer with no match at all
- [ ] Look for the "N swimmer(s) will be skipped" details link, if present, and expand it.
- **Expected:** Each skipped swimmer is named along with a plain-English reason (no match
      found / more than one possible match / suggested match not confirmed). Nothing is
      guessed at or forced through. Their date of birth is shown in a readable form (e.g.
      "12 Oct 2014"), not raw computer-style text.

---

## Part 4 — Reconciling times (conflicts and duplicates)

### 4.1 A genuine time conflict
Pick (or set up ahead of time) a swimmer who has a manually-entered or gala-synced PB for an
event where the SE report shows a **different** time on the **same date**.
- [ ] Find that event listed under "Time conflicts" in the review.
- **Expected:** Both times are shown side by side ("on file" vs "SE report"), with two radio
      options: Keep existing / Use SE report. Neither is chosen automatically for you.
- [ ] Try the "Keep all" / "Use SE report for all" buttons for that swimmer.
- **Expected:** All of that swimmer's listed conflicts switch together when you click one of
      those buttons; clicking an individual radio button still lets you override just one.

### 4.2 Probable duplicates
If a swimmer's existing PB for an event has the exact same time as the SE report but on a
**different** date (e.g. the gala's date vs. the SE session date for what was really the same
swim, or a backfilled PB you entered with a best-guess date):
- [ ] Look for a "Probable duplicates" section.
- **Expected:** It's listed there with **three** options, "Skip" selected by default:
      - **Skip** — leaves your existing entry exactly as it is; nothing from the SE report is
        imported for this one.
      - **Replace existing date with SE's** — removes your existing (possibly guessed-date)
        entry and keeps only the SE report's version, with the real date. Use this for a
        backfilled PB where you want the correct date on record going forward.
      - **Import as a separate result** — keeps your existing entry **and** adds the SE one
        alongside it as a second, distinct record.
- [ ] Next to the swimmer's name there are three buttons: **Skip all**, **Replace all**, and
      **Import all separately**. Click each in turn.
- **Expected:** Every probable duplicate for that swimmer switches to that choice at once;
      you can still override any single one afterwards with its own radio buttons.
- [ ] Watch the lines near the bottom as you change choices: "N new PB result(s) will be added"
      and "N existing PB record(s) will be updated".
- **Expected:** The numbers update immediately. "Skip" changes nothing. "Import as a separate
      result" counts as a **new** PB. "Replace existing date with SE's" counts as an
      **update** to an existing record, not a new one, because your swimmer ends up with the same
      number of PBs as before. Expand the update list to see each old date and new date.
- [ ] Try "Replace existing date with SE's" on one, then re-open ✏️ Edit on that swimmer.
- **Expected:** The old guessed-date entry for that event is gone; the SE-dated one is there
      instead, with the correct time. Nothing else for that swimmer changed.

### 4.2b The review number and the final result agree
- [ ] Before clicking Apply, note both figures: new PB results added, and existing records
      updated.
- [ ] Apply, then read the summary.
- **Expected:** The summary shows the same two numbers. Every entry in the SE report is counted
      exactly once, so added + updated + skipped + unchanged adds up to the number of results
      in the SE report. If it ever differs, stop and tell me the figures from both screens.

### 4.3 A swimmer with existing multi-date history for one event
If you have (or set up) a swimmer with **two or more** previously recorded times for the same
event and course (different dates) — the exact scenario last session's fix was about:
- [ ] Before importing, note down all their existing times for that event/course (✏️ Edit →
      scroll their PB list).
- [ ] Run the import and apply it (see Part 5).
- [ ] Re-open ✏️ Edit on that swimmer afterwards.
- **Expected:** **All of their original entries for that event are still there**, plus
      whatever the SE report added or reconciled. Nothing should have been silently replaced
      or lost.

---

### 4.4 A later Google Sheets sync must not undo your corrections
This matters because your Google Sheet still contains the old rows.
- [ ] Run an import where you choose **Replace existing date with SE's** for one or more probable
      duplicates, and apply it. Note the swimmer's PBs for those events (✏️ Edit).
- [ ] Run **📤 Manage Data → 🔄 Sync from Google Sheet → Sync Now**. Try it once with
      "Local-only swimmers" on **Keep** and once on **Remove**.
- **Expected:** Those swimmers' PB lists are unchanged — the old made-up-date rows do **not**
      come back. The sync message includes a blue note along the lines of "N Google Sheet PB(s)
      ... match a result already confirmed by the SE report under a different date, so they were
      not re-added", with a "Got it - Close" button so you can read it.
- [ ] (Optional) Delete or correct those rows in the Google Sheet and sync again.
- **Expected:** The note no longer appears, since there is nothing left to suppress.
- [ ] Add a genuinely new swim for that swimmer to the Google Sheet (different date and time) and
      sync.
- **Expected:** The new swim is added as normal — only copies of already-confirmed SE results
      are held back.
- **Note on the Keep / Hide / Remove setting:** it only decides what happens to *whole
      swimmers* who are on your dashboard but can't be found in the Sheet. For swimmers who
      **are** in the Sheet, it changes nothing, so Keep, Hide and Remove behave identically
      for the Arty test above.

### 4.6 Remove asks before it deletes anyone
Do this on a copy of your data or after downloading a backup, because the last step deletes.
- [ ] In the Google Sheet (or by editing a swimmer on the dashboard), make one swimmer's name
      differ between the two, e.g. "Arty Sushinski" on the dashboard and "Artyom Sushinski" in the
      Sheet, with the same date of birth.
- [ ] Open **🔄 Sync from Google Sheet**, set the dropdown to **Remove**, and click **Sync Now**.
- **Expected:** Before anything is deleted, a confirmation box lists each swimmer who would be
      deleted with how many PBs they have, and the total. The swimmer with the changed name is
      marked "possible rename: the Sheet has "Artyom Sushinski" with the same date of birth".
      The box says Cancel changes nothing.
- [ ] Click **Cancel**.
- **Expected:** The sync dialog says "Sync cancelled - nothing was changed". Check the swimmer is
      still on the dashboard with all their PBs, and "Last synced" has not changed.
- [ ] Change the dropdown to **Keep** and sync again.
- **Expected:** No confirmation appears (Keep and Hide never delete anything) and the sync
      completes normally.
- [ ] (Only with a backup in hand) Set **Remove** again, sync, and click **OK** on the box.
- **Expected:** The swimmers listed are deleted, and no one else.
- [ ] Set **Remove** when every dashboard swimmer is in the Sheet.
- **Expected:** No confirmation appears, because there is nothing to delete.

### 4.5 The Keep / Hide / Remove wording is clear
- [ ] Open **📤 Manage Data → 🔄 Sync from Google Sheet**.
- [ ] Read the label and the text under the dropdown, then open the dropdown.
- **Expected:** The label reads "Swimmers on the dashboard but not in the Google Sheet". The
      options read "Keep (leave them as they are)", "Hide (keep their data, hide from tabs)" and
      "Remove (delete swimmer and all their PBs)". The text underneath explains that this only
      affects swimmers who can't be found in the Sheet, that swimmers are matched by name and
      date of birth, that PBs of swimmers who *are* in the Sheet are always kept (manual and
      SE-imported too), and that **Remove deletes the swimmer and all of their PBs**.
- [ ] Check it reads comfortably on a phone-width window (the dropdown text shouldn't be cut off
      in a confusing way).
- **Please be careful with Remove.** Because swimmers are matched by name and date of birth, a
      swimmer you rename in the Sheet (for example "Arty" to "Artyom") looks "missing" to the
      dashboard until the names agree again. With Remove selected, that swimmer *and their
      SE-imported PBs* would be deleted. Keep is the safe choice unless you are sure.

## Part 5 — Applying

### 5.0a See what will actually be added before you commit
- [ ] Near the bottom of the review screen, look for "N new PB result(s) will be added".
- [ ] Click it to expand.
- **Expected:** Every result that will be added is listed individually — swimmer name, event,
      course, time, and date — not just a bare count. Useful as a last sanity check before
      applying anything.

### 5.0b The disabled state actually looks disabled
- [ ] With nothing ticked and nothing auto-matched (or just imagine/check this on a file with no
      matches), look at the **✅ Apply Import** button.
- **Expected:** It's visibly greyed out, not full blue — clearly not clickable, matching the
      "No swimmer is currently selected to import" note next to it.

### 5.0c Importing the same report again does nothing
- [ ] Apply an SE import for a swimmer so the dashboard now matches the report.
- [ ] Open **📥 Import SE PB Report** again and choose the same file(s).
- **Expected:** The swimmer is still auto-matched, but **✅ Apply Import is greyed out**, and the
      note reads "Nothing to import." with how many results already match what's on file (for
      example "15 result(s) already match what's on file"). There is no "will add 0 new PB
      results" line.
- [ ] Now give that swimmer a PB the report doesn't have, or change one time on the dashboard, and
      reopen the import with the same file.
- **Expected:** The button comes back to life as soon as there is something to do. Where a
      choice is needed, it stays greyed out while everything is on **Skip** or **Keep existing**,
      and the note says so ("3 probable duplicate(s) set to Skip ... change a Skip or Keep choice
      above if you do want it applied"). Switching one to Replace, Import separately or Use SE
      report turns the button on, and switching it back turns it off again.
- [ ] Remove a swimmer's SE # on the dashboard (leave their name and date of birth matching the
      report) and import again.
- **Expected:** The button is enabled, because the SE # would be filled in, and the note says
      "fill in the SE # for 1 swimmer(s)".

- [ ] With at least one auto-matched or confirmed swimmer, click **✅ Apply Import**.
- **Expected:** If nothing is selected to import yet, the button is disabled (and now visibly
      greyed out — see 5.0b) with a note explaining why — you can't accidentally apply nothing
      by mistake... or everything by mistake either, since unconfirmed suggestions are never
      included.
- [ ] After applying, a summary screen appears.
- **Expected:** It lists, in plain English: how many PBs were added, how many were updated,
      how many were kept as-is, how many probable duplicates were skipped, how many
      existing records were updated with the SE report's real date (if you used that option in 4.2), and
      whether any swimmer gained a newly-filled-in SE #. A "not imported" list (if any) names
      who and why.
- [ ] Click **Done**.

### 5.1 Confirm nothing unexpected changed
- [ ] Open ✏️ Edit on a swimmer who was auto-matched or confirmed.
- **Expected:** Their **Squad, Gender, Date of Birth, and Name are exactly as they were
      before** — only their PB list changed.
- [ ] Check the County or Regional tab for that swimmer.
- **Expected:** Their PB Time shown is still their genuine fastest across everything on file,
      same as always — nothing about how those tabs work changed.
- [ ] If any swimmer gained an SE #, confirm it via ✏️ Edit → the SE # field now shows the
      report's number.

### 5.2 A swimmer not in your dashboard at all
- [ ] If the SE report includes anyone who isn't currently a swimmer in your dashboard, check
      the "not imported" list from the summary (or the review screen beforehand).
- **Expected:** They're named there as unmatched. **No new swimmer was created for them** —
      check your swimmer count in 📤 Manage Data hasn't changed because of the import.

---

## Part 6 — Cancelling is truly safe

- [ ] Reopen the import, choose files, get to the review screen, tick a few things — then click
      **Cancel** (or the ✕ in the corner) instead of applying.
- [ ] Check a swimmer you were about to confirm/reconcile.
- **Expected:** Absolutely nothing changed — no partial PBs added, no SE # filled in. Cancelling
      at any point before "Apply Import" is a true no-op.

---

## Part 7 — Mobile check

Do this on an actual phone if you can, or by narrowing your desktop browser window to roughly
phone width (under ~500px).

- [ ] Open the import on mobile and look at the file picker field.
- **Expected:** It's full-width and comfortably tappable, matching every other file field in
      Manage Data (no overflow or squeeze).
- [ ] Get to the review screen with at least one conflict or suggested match showing.
- **Expected:** Everything is readable and scrollable without horizontal scrolling; the
      Cancel/Apply buttons stay reachable at the bottom without having to scroll all the way
      down first.

---

## Part 8 — General sanity check (nothing else broke)

- [ ] Add a swimmer the normal way (👤 Add Swimmer) — still works as before.
- [ ] Sync from Google Sheets normally — still completes with the usual success message.
- [ ] Download a Full Backup & Restore bundle — still downloads fine.
- [ ] Overview tab (Squad Composition, Hot Right Now, The Bubble List) still loads normally.
- [ ] County and Regional tabs still show swimmers and qualifying comparisons as before.

### 8.1 Adding a PB to a swimmer with lots of them is now easier
- [ ] Open ✏️ Edit on a swimmer who already has many PBs.
- [ ] Scroll to the very top of the list, then to the very bottom.
- **Expected:** **＋ Add PB entry** stays visible the whole time, floating with Cancel and Save
      Changes at the bottom of the window, so you never lose sight of it wherever you are in
      the list.
- [ ] Click it.
- **Expected:** The view scrolls to the new blank row with the Event field ready to use, so you
      shouldn't have to go looking for it. On a phone-width window, check the three controls
      still fit comfortably without covering too much of the list.

---

## A habit worth keeping once you're using this for real

**Full Backup & Restore (📤 Manage Data → 🗄️ Full Backup & Restore) replaces everything it
restores** — it doesn't merge. If you restore a backup taken *before* an SE import, you lose
whatever that import added or corrected, the same as you'd lose any other change made since
that backup. This isn't new or specific to the SE import, but it's worth a habit: **download a
fresh backup right after any real SE import you intend to keep**, the same way you already do
before testing something new.

## A note on something you might notice, but isn't a problem

A PB imported this way is tagged internally with `"source": "se"` if you ever download a
`swimmers_pb.json` export and look closely. This is the same kind of internal tagging that
`"gala"` and `"manual"` PBs already carry (added last session) — it doesn't change how any PB
is displayed or compared anywhere in the dashboard, it just records where each time came from.
