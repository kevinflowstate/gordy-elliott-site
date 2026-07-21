# App Store Screenshot Plan

## Required delivery

- Platform: iPhone only for version 1.
- Primary set: portrait screenshots for App Store Connect's current 6.5-inch display slot.
- Accepted target: `1284 x 2778` pixels, generated from a `428 x 926` viewport at 3x scale.
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

Generate the six ordered draft captures with:

```bash
PORTAL_QA_BASE_URL=https://gordy-elliott-site.vercel.app \
PORTAL_QA_STORAGE_STATE=/path/to/demo-client-state.json \
npm run capture:app-store
```

The script refuses to continue unless the authenticated dashboard visibly identifies the fictional Demo Client. It writes opaque JPEGs and a non-secret manifest under the external Xcode volume by default. Draft captures are for visual review; repeat the command against the approved release candidate before uploading the final set.

The final production-backed set is stored outside source control at:

`/Volumes/XCode/Storage-Quarantine-2026-07-15/SHIFT-AppStore-Screenshots/2026-07-21-production-final-v2`

All six files were verified as opaque JPEGs at `1284 x 2778`, visually inspected and uploaded to App Store Connect in the capture-sequence order above.
