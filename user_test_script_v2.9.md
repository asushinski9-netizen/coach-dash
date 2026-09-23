# Coach Dashboard v2.9 — User Test Script

A step-by-step manual checklist for a coach (no dev tools needed) to confirm everything shipped
this session actually works, before trusting it day-to-day. This is separate from — and doesn't
replace — the automated `test_se_field.js`/`probe_se_field.js` checks, which verify the
underlying code logic but not what you actually see and click.

**What this session covers:** the SE # field end-to-end (Add/Edit Swimmer, Google Sheets sync,
conflict handling), and two mobile fixes (Date of Birth/Date Set field overflow, and text
fields zooming the page in on tap).

Tick each box as you go. If anything doesn't match the "Expected" column, stop and tell me
exactly which step failed and what you saw instead — that's much faster to fix than "it's not
working."

---

## Part 0 — Before you start

- [ ] **0.1** You're viewing the v2.9 `index.html` file (check the browser tab title says
      "Coach Dashboard v2.9", or the page `<title>` if you check "View Page Source").
- [ ] **0.2** If you're testing the Sheets sync part (Part 2 below), open
      **⚙️ Settings** and confirm the **Apps Script Web App URL** field matches the URL shown
      in your Apps Script project under **Deploy → Manage deployments** for the deployment
      that's actually running `apps_script_v2.2.3.gs`. *(This was the exact thing that bit us
      last time — a new deployment gives a new URL, and the dashboard doesn't know to update
      itself.)* If they don't match, update the Settings field to the current one now, before
      testing anything sync-related.

---

## Part 1 — SE # in Add/Edit Swimmer (no Sheet involved)

### 1.1 Add a new swimmer with a valid SE #
- [ ] Open the **＋** menu → **👤 Add Swimmer**.
- [ ] Fill in Name, Date of Birth, Gender as normal.
- [ ] In the new **SE #** field (below Gender/Squad), type a real-looking number, e.g. `1234567`.
- [ ] Save.
- **Expected:** Swimmer saves with no error. Re-open them via **✏️ Edit** and confirm the SE #
      field still shows `1234567`.

### 1.2 Add a swimmer with an invalid SE #
- [ ] Repeat 1.1, but type letters into SE #, e.g. `ABC123`.
- [ ] Save.
- **Expected:** A red error appears mentioning SE #, and the swimmer is **not** saved (you're
      still on the Add Swimmer form). Clear the field or fix it, then Save again — it should
      go through.

### 1.3 Add a swimmer with SE # left blank
- [ ] Repeat 1.1 but leave SE # empty.
- **Expected:** Saves with no error. Re-opening via Edit shows SE # blank — not `0`, not
      `undefined`, just empty.

### 1.4 Edit an existing swimmer to add an SE #
- [ ] Pick any existing swimmer with no SE # on file. Click **✏️ Edit**.
- [ ] Enter a valid SE # and Save.
- **Expected:** Saves fine. Re-opening Edit shows the value you entered.

### 1.5 Clear an SE # via Edit
- [ ] Open a swimmer that now has an SE # (from 1.4). Delete the value in the SE # field
      entirely. Save.
- **Expected:** Saves fine. Re-opening Edit shows the field blank again.

---

## Part 2 — SE # via Google Sheets Sync

*Do Part 0.2 first if you haven't already.*

### 2.1 Confirm the Sheet has the right column
- [ ] Open your club's Google Sheet → **"Basic Data"** tab.
- [ ] Confirm there's a column E with the header **"SE #"**, and it has real values for at
      least one or two swimmers.

### 2.2 Sync and check a swimmer that had no local SE # before
- [ ] In the dashboard: **📤 Manage Data → 🔄 Sync from Google Sheet → 🔄 Sync Now**.
- [ ] Wait for the success message.
- [ ] Open **✏️ Edit** on one of the swimmers whose Sheet row has an SE # value.
- **Expected:** The SE # field shows the value from the Sheet.

### 2.3 Change a value in the Sheet and re-sync (conflict warning)
- [ ] Pick the same swimmer from 2.2. In the Google Sheet, change their SE # to a different
      number.
- [ ] Re-sync from the dashboard.
- **Expected:** The sync success message includes a line like *"⚠️ SE # changed on 1
      swimmer(s) (Name) — double-check the Sheet if that looks wrong."* Open Edit on that
      swimmer — the SE # should now show the **new** value from the Sheet (the Sheet always
      wins), not the old one.

### 2.4 Leave a Sheet SE # blank for someone who already has one locally
- [ ] Pick a swimmer who has an SE # in the dashboard. In the Sheet, leave their SE # cell
      **blank** (don't put a value there).
- [ ] Re-sync.
- **Expected:** That swimmer's SE # in the dashboard is **unchanged** — a blank Sheet cell
      should never erase an SE # the dashboard already has on file for them.

### 2.5 Manual upload merge doesn't touch SE #
*(Only relevant if you use the manual file-upload merge feature — skip if you don't.)*
- [ ] **📤 Manage Data → 🏊 Swimmers & PBs → Upload** a swimmers JSON file using **Merge**
      (not Replace), where that file has a *different* SE # for someone who already has one
      in the dashboard.
- **Expected:** No conflict warning, and the existing SE # is **kept**, not overwritten — only
      an authoritative Sheet sync (Part 2.3 above) should ever change or flag an SE # conflict.

---

## Part 3 — Mobile: Date of Birth / Date Set no longer overflow

Do this on an actual phone if you can, or by narrowing your desktop browser window to roughly
phone width (under ~500px).

### 3.1 Add Swimmer — Date of Birth
- [ ] Open **👤 Add Swimmer** on your phone.
- [ ] Look at the Name / Date of Birth row.
- **Expected:** Both fields are stacked one above the other (not squeezed side-by-side), and
      the Date of Birth field is fully visible with no part of it cut off or requiring
      horizontal scrolling to reach.

### 3.2 Add Swimmer — Date Set (in a PB row)
- [ ] In the same modal, look at a Personal Best row (Event / Course / Time / Date Set).
- **Expected:** All four fields stack cleanly, full-width, with Date Set fully visible and
      usable — no overflow past the edge of the screen or the modal.

---

## Part 4 — Mobile: text fields no longer zoom the page

Do this on an actual iPhone (iOS Safari) if at all possible — this bug is iOS-specific and
won't reproduce on Android or desktop.

### 4.1 Tap into a few different fields around the app
- [ ] Tap the **Search Swimmer** box on the County or Regional tab.
- [ ] Tap the **Date of Birth** field in Add Swimmer.
- [ ] Tap a **dropdown** (e.g. Gender, or a filter-bar select).
- [ ] Tap the **day-cutoff** number box on the Overview tab's "Hot Right Now" section.
- **Expected for each:** The page stays at its normal zoom level the whole time — no sudden
      zoom-in the moment you tap in. Type something, then tap elsewhere to leave the field.
- **Expected after tapping out:** The page is still at normal zoom — you should **not** need
      to manually pinch back out.

---

## Part 5 — General sanity check (nothing else broke)

- [ ] Add a swimmer with a couple of PBs (no SE # needed) — saves and displays normally on
      County/Regional tabs as before.
- [ ] Sync from Google Sheets normally (with no SE # conflicts pending) — completes with the
      usual success message, no unexpected errors.
- [ ] Overview tab still loads (Squad Composition, Hot Right Now, The Bubble List) with no
      layout weirdness on both desktop and mobile.

---

## A note on something you might stumble across, but isn't a real problem

If you (or a future developer) run the automated `test_overview.js` script, you'll see 2
failing checks about the Bubble List's "Include hidden / Former Swimmers" toggle. **This is a
stale test, not a real bug** — the toggle itself was directly verified to work correctly. Full
explanation is in `known-bugs-and-fixes.md`, Open Issue #7, if you're curious. Nothing for you
to test or worry about here.
