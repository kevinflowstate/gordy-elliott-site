# TestFlight Checklist

Record device model, iOS version, build number, tester and result for every run.

## Install and account

- Install cleanly from TestFlight and launch from a terminated state.
- Confirm the splash/offline states fit the screen and no website browser chrome appears.
- Sign in, terminate, relaunch and confirm the session persists.
- Test invalid password, password reset and the return link into the app.
- Confirm Sign Out returns to login and another account cannot see the previous session.
- Confirm account deletion requires typing `DELETE`; do not complete this step on the shared review fixture.

## Client journeys

- Dashboard: tasks, attention state and all cards fit without sideways scrolling.
- Training: open a session, record a set and verify history persists.
- Nutrition: assigned plan, totals and food interactions remain usable with the keyboard open.
- DM: send/receive, unread badge, keyboard, background/foreground and external links.
- Check-in and Daily Tracker: save, reload and edit without duplicate submissions.
- Progress/gallery: camera and photo-library permission paths, upload, cancel and denial state.
- Cycle Tracker: visible only for eligible opted-in female accounts; safety copy remains client-appropriate.
- Pause/freeze: paused coaching suppresses attention noise; frozen access shows the paused screen.
- Connected Apps: unavailable state before Terra credentials, then widget hand-off and return after Terra is live.

## Device behaviour

- iPhone SE/small display and one current large iPhone.
- Light/dark system setting, larger text and VoiceOver labels on main navigation.
- Airplane mode at launch and while already signed in; retry after reconnecting.
- Incoming call/app backgrounding during DM, tracker entry and photo selection.
- External privacy/support links open correctly and return to AT CAPACITY cleanly.
- No clipped text, landscape-only layout, horizontal page movement, blank screen or persistent spinner.

## Release evidence

- Screenshot or short recording for each P0/P1 issue and its retest.
- App Store screenshots captured from the approved candidate, not a development build.
- Crash reports and Organizer validation reviewed before submission.
- Testers confirm no real client health information appears in screenshots or review notes.
