# TestFlight Checklist

Record device model, iOS version, build number, tester and result for every run.

## Install and account

- Run this checklist against AT CAPACITY 1.0 (10), selected in App Store Connect from the signed archive recorded in `docs/app-store-release-audit.md`.
- Install cleanly from TestFlight and launch from a terminated state.
- Confirm the splash/offline states fit the screen and no website browser chrome appears.
- Sign in, terminate, relaunch and confirm the session persists.
- Test invalid password, password reset and the return link into the app.
- Confirm Sign Out returns to login and another account cannot see the previous session.
- Confirm account deletion requires typing `DELETE`; do not complete this step on the shared review fixture.

## Client journeys

- Dashboard: tasks, attention state and all cards fit without sideways scrolling.
- Training: choose a session without the picker being obscured by navigation; start the native workout; open Session overview; jump to an exercise; inspect Up next; record sets; use Apply set 1 to all; background and terminate the app; confirm the exact draft resumes; finish offline; reconnect; confirm the queued result syncs; reopen and edit the completed session; confirm history persists.
- Nutrition: assigned plan, totals and food interactions remain usable with the keyboard open.
- DM: send/receive, unread badge, keyboard, background/foreground and external links.
- Check-in and Daily Tracker: save, reload and edit without duplicate submissions.
- Progress/gallery: camera and photo-library permission paths, upload, cancel and denial state.
- Cycle Tracker: visible only for eligible opted-in female accounts; safety copy remains client-appropriate.
- Pause/freeze: paused coaching suppresses attention noise; frozen access shows the paused screen.
- Health & Capacity: consent disappears permanently after acceptance, each provider starts disconnected, widget hand-off returns to the installed app, and successful providers settle on Connected rather than Pending.
- Connected-health data: Oura sleep, HRV, readiness and activity populate independently; nutrition is not shown as missing merely because an Oura user does not track food.
- MyFitnessPal: provider login, native return and synced nutrition totals complete without exposing a raw Terra gateway error.

## Device behaviour

- iPhone SE/small display and one current large iPhone.
- Complete the evidence matrix in `docs/app-store-accessibility.md`, including 200%+ text, VoiceOver, Voice Control, Reduce Motion and colour-independent states.
- Airplane mode at launch and while already signed in; retry after reconnecting.
- Incoming call/app backgrounding during DM, tracker entry and photo selection.
- External privacy/support links open correctly and return to AT CAPACITY cleanly.
- No clipped text, landscape-only layout, horizontal page movement, blank screen or persistent spinner.

## Release evidence

- Screenshot or short recording for each P0/P1 issue and its retest.
- App Store screenshots captured from the approved candidate, not a development build.
- Crash reports and Organizer validation reviewed before submission.
- Complete `docs/app-store-reviewer-walkthrough.md` and retain the native-behaviour evidence for the Guideline 4.2 review position.
- Testers confirm no real client health information appears in screenshots or review notes.
