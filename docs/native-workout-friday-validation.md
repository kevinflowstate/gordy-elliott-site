# Native workout validation for Friday 9 October 2026

Scope: support reports AC-A01E8D6355E8, AC-4C65C625D3F0, AC-AAA2ECBAAF82 and AC-C78386C55F79. Source updated on 7 October in `codex/gordy-support-week`. Bundle with the week's native changes; Kevin's instruction is no upload or submission before Friday 9 October. Build 10 is the published omission; the 5 October Build 11 archive predates this layout change and cannot establish delivery of it.

## Source changes and automated evidence

- One exercise heading is used by preview, grouped summary, active cards, review and overview. Longer/multiline prescriptions and long names use the full width; short badges have a 100-point cap and names have layout priority. Accessibility Dynamic Type stacks all prescriptions. Overview always stacks to reserve space for its position/current indicator. No prescription truncation or font shrinking is used. The final saved confirmation has no exercise-name/prescription row; its preceding review uses the shared heading.
- Preview identifies grouped blocks. The active grouped runner retains original section labels, each member's name, original prescription and notes, timer controls and per-exercise result inputs. Existing section-safe block IDs, AMRAP duration, alternating EMOM cues and demo URLs are carried by the shared bridge without new payload/schema changes.
- EMOM display omits stale circuit round counts; its final sync omits only `circuit_rounds`. Weight, reps, notes, completion and original exercise-item IDs are preserved. AMRAP/circuit round logging remains intact.
- Timer state transitions now live in the Foundation set model used by the native controls. Absolute deadlines, pause remaining time, resumed total duration, manual timer reset and round/result preservation are covered by actual Swift model checks.

Run focused native model checks with `python3 scripts/check-native-workout-models.py`. The production Swift model compiled and all **36 assertions passed** on 7 October. The native bridge/grouping/circuit suite also passed **14 tests** with `node_modules/.bin/tsx --test tests/native-workout.test.ts tests/workout-groups.test.ts tests/workout-circuit-controls.test.ts`.

SwiftUI DEBUG previews include a 320-point small-phone frame, largest accessibility size, long names and Andrew's exact Air Bike prescription: `arms and legs moving together ; Time 3 min 0 sec`. Preview fixtures are prepared; they are not rendered-device evidence.

## Required before submission

Automated model checks and source inspection do not establish installed iPhone behavior. The following remain device acceptance checks on the final numbered build, with an owned fictional populated account. Record the build number, device/iOS version and outcomes before submission.

- [ ] Full iOS compile passes after all native work, using external DerivedData. Increment the build and archive the final source.
- [ ] At 320-point/small iPhone width and large/accessibility text, Andrew's quoted Air Bike instructions sit below the readable full name on intro, active, overview and review. Test the long Romanian-deadlift name and a short `3 x 10` badge too; preserve vertical scrolling.
- [ ] A superset stays paired as one block with its label. A three-member circuit stays together; singles and repeated labels across sections stay distinct. Previous/Next and overview jumps land on block boundaries.
- [ ] A six-minute AMRAP displays the original instructions and all names, increments/decrements rounds, retains individual reps/weights/notes, pauses/resumes and resets correctly. Leave/reopen and background/foreground retain the draft and clock; save produces the expected coach log.
- [ ] Six-minute EMOM alternates odd/even exercise names at minute boundaries. Pause/reopen retains the minute, resume continues it, reset returns to minute one, completion does not invent a seventh minute. No rounds control/summary appears; saved results have no AMRAP round value.
- [ ] Valid representative demo links open and return without losing entered workout values or the running/paused timer. Missing/invalid demo URLs show no demo button. Do not claim every exercise has a video.
- [ ] Saved/edit mode retains reps, weights, notes, completion and AMRAP rounds; EMOM edit mode avoids invented elapsed minutes. Offline queue/save and later sync preserve original exercise item IDs.

No physical iPhone walkthrough, full Xcode build, archive, upload or submission was performed by the native-workout task. The parent release task owns final build and device verification.
