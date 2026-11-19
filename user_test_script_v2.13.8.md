# Coach Dashboard - v2.13.8 test script (Roster: interactive pies on desktop, toggle chips on mobile)

The Squad Composition pies now sit at the top of the 🏊 Roster (desktop). Clicking a slice or legend entry removes that group from the list, and the
filters, pies and (on a phone) chips all stay in step. If a step does not match "Expected", tell me the step number (a screenshot helps).
**My tests cannot judge how the pies look or how the phone layout feels, so Parts 1 and 5 matter most.**

## Part 0
- [ ] **0.1** Tab title says **Coach Dashboard v2.13.8** (hard refresh if not). **0.2** Overview's pies still look and work as before.

## Part 1 - Pies on desktop
- [ ] **1.1** Three pies (**By Gender, By Squad, By Age**) sit at the top of the Roster, above the filter bar, with the same look as Overview. Each centre shows the number of swimmers currently listed.
- [ ] **1.2** Click the **Boys slice** (or the Boys entry in the legend). **Expected:** boys disappear from the list, Boys is struck out in the legend and its slice leaves the ring, the **Gender** dropdown switches to Girls, and the Squad and Age pies recount for the swimmers left.
- [ ] **1.3** The struck-out Boys entry still shows how many boys there would be if you bring them back. Click it: they return and the Gender dropdown goes back to All.
- [ ] **1.4** Choose **Squad = Junior** in the dropdown: the Squad pie keeps only Junior (the others struck out) and the other pies recount for juniors.
- [ ] **1.5** Strike out two squads in the pie (e.g. Senior and Active). **Expected:** the Squad dropdown reads **Custom**, and the footer heading says "Squad: excluding Senior, Active"; each swimmer listed there reads what they ARE (e.g. "Ben Brown - Senior").
- [ ] **1.6** Click an **age** in the Age pie: that age leaves the list; choose an age in the Age dropdown and every other age is struck out.
- [ ] **1.7** Search, Source and Flag filters change the pie counts. Show Former Swimmers adds a "Former Swimmer" slice; Show hidden swimmers adds hidden swimmers to the counts.
- [ ] **1.8** **Reset Filters** brings every slice back.
- [ ] **1.9** The **▾ Charts** button hides and shows the pies, and remembers your choice after a refresh. The list and filters still work with the pies hidden.
- [ ] **1.10** Overview's own pies behave exactly as before (legend click only; striking something out there does not change the Roster).

## Part 2 - Counts and the list
- [ ] **2.1** The list, the footer ("N of M swimmers shown", "N not shown (click for why)") and the pies always agree.
- [ ] **2.2** Expand/Collapse, Sort, Edit and Delete still work as in v2.13.7.

## Part 3 - Phone width
- [ ] **3.1** The three pies and the Charts button are **not shown** on a phone. Instead, near the top there is a row of **five chips**: **Boys, Girls, Junior, Senior, Development**, each with a count; all start "on".
- [ ] **3.2** Tap **Boys**: the chip dims and is struck through, boys leave the list, the other chips' counts update, and the Gender dropdown shows Girls.
- [ ] **3.3** Turn off two squad chips (e.g. Junior and Senior): the Squad dropdown reads **Custom**. Reset Filters turns every chip back on.
- [ ] **3.4** Chips fit the screen without sideways scrolling. Tabs: Overview, Roster, then County and Regional sharing a row (unchanged).
- [ ] **3.5** Resize between phone and desktop width: pies and chips swap, and both show the same selections.

## Part 4 - Nothing else broke
- [ ] **4.1** County QT, Regional QT, Manage Data, SE import and Backup work as before.
