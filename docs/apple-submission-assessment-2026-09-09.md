# AT CAPACITY — Apple submission assessment

9 September 2026, 14:11 UTC. **Verdict: NOT READY.**

WHOOP is hidden in production and does not need to hold up version 1. The wider app has two substantive review blockers, a payment-presentation risk, and an incomplete final native-device check. This assessment supersedes the more optimistic 26 August audit.

## Recommended release decision

Fix AI permission and either finish the community safety controls or defer community consistently for everyone in this release. Remove the Documents upgrade invitation and reconcile the business-model explanation. Then run the exact TestFlight candidate through the final reviewer walkthrough and reconcile App Store Connect. Submit only after those checks pass. No Apple submission or listing changes were made during this audit.

## Findings that matter

### P1 — Personal information can reach AI without specific permission

Apple requires explicit permission before personal data is shared with third-party AI. [Guideline 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)

The production AI screen immediately offers a message composer and suggested prompts, and says it knows the client's training, nutrition, check-ins and goals. It has no provider disclosure or permission step. Source inspection confirms that `app/api/portal/ai/route.ts` loads coaching context and calls Anthropic without checking AI consent. Consultation submission separately sends answers to OpenRouter when configured: `app/api/portal/consultation/route.ts:229`. Its checkbox only describes Gordy's coaching use (`app/portal/consultation/page.tsx:286`). The public privacy policy names AI providers, but that disclosure is not a specific permission gate. Coach-side AI also needs inclusion in the remediation scope.

**Required correction:** name the actual recipients and information shared, collect and record explicit permission, and enforce it server-side before client, consultation and coach-triggered AI calls. Provide a usable non-AI path when permission is declined. Audit embeddings as well as chat. Merely changing the privacy-policy wording or adding a checkbox that the backend ignores will not resolve this.

Evidence: live production AI screen and privacy page; the routes above; no AI request was sent during this assessment.

### P1 — SHIFT group chat lacks essential user safety controls

Apple's user-generated-content rules require filtering, reporting, blocking and reachable support. [Guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)

The app now supports shared text, image, audio and file messages for active SHIFT members. Membership checks and private media storage are present. Gordy can delete posts. However, `components/community/ShiftCommunityClient.tsx`, `app/api/community/route.ts`, its media route and `lib/community-server.ts` contain no user reporting/blocking system or objectionable-content filtering. Text validation checks length; the deletion route is admin-only. A closed membership group does not by itself supply those controls.

The CAPACITY reviewer fixture cannot exercise this SHIFT-only experience. Existing submission notes and the age-rating worksheet describe private one-to-one messaging and omit the shared group. The current public privacy notice does disclose SHIFT Community, so the documents are inconsistent.

**Required correction:** implement the missing protections, their moderation workflow and reviewer access; or defer community through navigation and server enforcement for all affected users in the release. Update the review notes and age-rating answers to the final feature set. Do not hide an active feature only from Apple's reviewer account.

Evidence: source and production policy; no real SHIFT messages were accessed or posted and no member was blocked/deleted.

### P2 — Payment presentation needs correction and clarification

The Documents screen tells excluded users to message Gordy about upgrading. This conflicts with the proposed free-companion rationale, which depends on avoiding purchase calls to action. Apple's one-to-one service exception concerns real-time individual services; a paid digital-content tier needs its own assessment. [Guidelines 3.1.3(d–f)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods)

Evidence: `app/portal/documents/page.tsx:106` says “Upgrade to Access” and invites an upgrade discussion. The app has multiple coaching tiers; the review notes simply say payments happen outside the app. That statement alone does not establish an exemption.

**Recommended correction:** remove the upgrade invitation from the submitted app and accurately explain what clients purchase, where coaching is delivered, and whether standalone digital plans/features are sold. Confirm the payment approach for worldwide availability. This is a review risk requiring resolution, not a claim that Apple has already rejected the business model.

### Final verification gates remain open

- **Exact Build 10 on an iPhone:** cold launch, password login, session persistence, native workout save/edit and offline recovery, photo/voice permissions, notification receipt/opening, password-reset Universal Link, provider returns and crash review after the final hosted deployment. Xcode currently lists all paired devices as unavailable; iPhone Mirroring says the phone is in use. Browser testing cannot close this gate.
- **App Store Connect:** the Apple session has expired. Current selected build, agreements/trader status, screenshots, age rating, privacy answers, reviewer password and crash feedback could not be freshly inspected. The 26 August record reports Build 10 selected, manual release, published privacy details and Prepare for Submission; these remain historical evidence.
- **Reviewer coverage:** supply access to every retained client experience, including SHIFT-specific features if retained. Today's authenticated browser session used a one-use login for the verified fictional fixture. It does not prove that the password stored in App Store Connect still works.
- **Accessibility:** complete the physical usability checks and claim only demonstrated support. Unselected accessibility labels alone should not be represented as an Apple submission blocker: Apple provides a “support not yet indicated” state and says label publication requires a live version for that device. [Apple's accessibility-label instructions](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/manage-accessibility-nutrition-labels/)

Apple's submission procedure requires complete metadata and the correct selected build. [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)

## What passed

| Area | Current evidence | Limit |
|---|---|---|
| WHOOP visibility | Production connection page shows Garmin, Oura, MyFitnessPal and Fitbit; no WHOOP. Mobile viewport 390 × 844 has no horizontal overflow. | Existing WHOOP credentials/history are preserved; upstream delivery remains unresolved. |
| Automated checks | 279 tests pass; TypeScript passes; lint has 0 errors and 41 existing warnings; hosted production build succeeds. | Tests do not establish policy compliance or physical-device behaviour. |
| iOS preparation | Native sync and release preflight pass with Gordy's bundle/team and HTTPS origin. | Initial preflight needed generated Capacitor configuration; rerun passed after normal sync. No new archive uploaded. |
| Candidate archive | Existing 1.0 (10) archive has bundle `com.gordyelliott.atcapacity`, Xcode 26.3, iOS SDK 26.2, iPhone-only family, purpose strings and exempt-encryption declaration. Strict deep code-signature verification passes. | App Store Connect processing/selection was not freshly rechecked. |
| SDK deadline | Archive meets Apple's current Xcode 26 / iOS 26 minimum. [Official requirements](https://developer.apple.com/news/upcoming-requirements/) | Eligibility is one part of review readiness. |
| Review fixture | Read-only production check passes: active CAPACITY client, 2 sessions/10 exercises, 4 meals, 3 recent tracker entries, 2 check-ins and 2 DMs; no pending/errored wearable connections. | SHIFT coverage and stored review-password test remain open. |
| Browser journey | Signed-in fixture reaches health connections, opens the five-exercise workout overview, loads four nutrition meals and both sides of the example coach conversation. | No workout save, new message, file upload or provider connection performed. |
| Account controls | Settings exposes privacy/support links and deletion; final delete stays disabled until confirmation text is entered. Cancel works. | No account deleted; external revocation failure paths were reviewed in source/tests. |
| Public information | Production privacy and support pages load; support has an account-access email and deletion guidance. | AI consent gap remains; reconcile policy, app behaviour and published labels. |
| Native value | Source includes SwiftUI workout runner, local drafts/queued sync, haptics, push and native return handling. | Supports the case under [Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality); exact-build demonstration still required and approval remains Apple's decision. |

Coverage: seven bounded browser checks passed (fixture login, WHOOP connections, workout opening, nutrition display, DM display, deletion safeguard, public information). AI presentation failed the consent assessment. **Zero complete physical-device release walkthroughs were completed today.** Cross-role writes, payment/deletion, provider authorisation and hardware journeys were deliberately not exercised against live clients.

## WHOOP deployment and source handover

- Production: [app.onlinegordy.com](https://app.onlinegordy.com)
- Deployment: `dpl_295J5EP1mAnBDsf1wVtAiwuBPqsD`, READY, production alias verified.
- Code: `6128811fe7805fa751f76114a3141324f16f51ed`, branch `codex/whoop-data-investigation`.
- Production `TERRA_WHOOP_ENABLED=false`; both connection action and connected-service presentation are hidden. Re-enabling requires restoring the flag and redeploying after provider acceptance.
- Earlier empty-payload/readiness correction `7addef3` is retained. No webhook deauthentication, health-summary repair or data deletion was performed.
- Source worktree: `/Users/kevinharkin/Codex-Worktrees/gordy-whoop-data`. Main remains `958334e` and lacks these branch corrections; integrate the reviewed branch before the next main-based deployment to avoid regression.
- Detailed deployment metadata: `whoop-hidden-deployment.json`; verification logs: `apple-audit-tests.log`, `apple-audit-types.log`, `apple-audit-lint.log` alongside this report.

## Fixture and cleanup record

Used only the marked fictional App Review account. No coaching content or provider connections were changed. Opening DM can update its normal read state; no message was sent. The workout overview was closed without starting/logging a workout; deletion confirmation was cancelled. The one-use local login helper was stopped and temporary audit scripts removed. The browser viewport override was restored. App Store Connect was left at sign-in for Kevin; no submission action was taken.

**Next action:** address the two P1 findings and payment presentation, then complete one final exact-build reviewer run and App Store Connect reconciliation. WHOOP can stay deferred throughout.
