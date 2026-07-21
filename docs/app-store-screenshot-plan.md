# App Store Screenshot Plan

## Required delivery

- Platform: iPhone only for version 1.
- Primary set: 6.9-inch portrait screenshots from iPhone 17 Pro Max.
- Accepted target: `1320 x 2868` pixels for that simulator/device profile.
- Format: opaque PNG or JPEG with no alpha channel.
- Quantity: six screenshots, all captured from the approved candidate and fictional Demo Client data.
- Do not include real client names, messages, health data, body images or notification previews.

Restricting version 1 to iPhone avoids an untested iPad interface and the separate mandatory 13-inch iPad screenshot set.

## Capture sequence

| Order | Screen | Product-page message | Required state |
| --- | --- | --- | --- |
| 1 | Dashboard | Your coaching day, clear at a glance | Demo Client, current tasks and no error/empty states |
| 2 | Training | Your plan and next session, ready | Complete active programme visible before secondary content |
| 3 | Active session | Log every set without losing focus | Session glow/timer visible with no keyboard |
| 4 | Daily Tracker | One minute to keep coaching personal | Current sliders and three recent fictional days |
| 5 | DM | Direct access to your coach | Neutral two-way fictional conversation |
| 6 | Nutrition or Connected Apps | Targets and recovery context in one place | Complete nutrition plan, or real Terra provider state only after credentials exist |

## Visual rules

- Prefer the real app UI at native resolution. Any headline overlay must leave the workflow legible and remain within the screenshot canvas.
- Keep the SHIFT black, white and magenta visual language; do not add device frames, fake controls or unsupported feature claims.
- Use the same status-bar time and a clean battery/network state across the set.
- Hide keyboards, debug banners, mock labels, browser chrome and personal notifications.
- Inspect every final PNG for dimensions, alpha channel and accidental private data before upload.

## Automation output

Store raw candidate captures outside source control under the external Xcode volume. Record the build number, simulator UDID, route and timestamp in the release evidence sheet. Upload only the final opaque exports to App Store Connect.
