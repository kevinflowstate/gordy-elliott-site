# Apple release corrections — 9 September 2026

Kevin authorized explicit AI-sharing consent, deferring group chat from the first release, and removing the Documents upgrade invitation. He also confirmed that the previous iPhone walkthrough was completed. WHOOP remains unavailable pending Terra's investigation.

## Changes

- AI sharing defaults off. Clients see the information categories, named recipients (Anthropic, OpenAI and OpenRouter routing to OpenAI), purpose and withdrawal terms before choosing. The choice is available before AI chat, on the consultation form, and in Settings.
- Permission events record the authenticated owner, decision, disclosure version and time. Existing accounts are not opted in. Direct authenticated database reads/writes are denied. Account deletion cascades the permission records.
- Client AI chat, retrieval embeddings, consultation summaries and coach-triggered client processing enforce current permission on the server. Missing/outdated/withdrawn permission blocks sharing; an unavailable permission check fails closed. Consultation submission still saves a deterministic summary with AI off.
- Coach AI's automatically supplied roster includes only consenting clients. A permission change invalidates prior roster conversation history. The coach confirms that manually entered prompts contain information only about consenting clients. Generic nutrition templates require a separate confirmation that the brief contains no personal client information.
- Group-chat navigation, direct pages and read/post/upload/delete APIs are unavailable for this release, including for admins. Existing stored content is retained. Private coach DMs remain available.
- Documents no longer invites clients to upgrade or discuss a purchase. The privacy policy and prepared Apple review notes describe the revised behavior.

## Verification and deployment

The SQL migration `20260909143000_record_ai_sharing_consent.sql` was applied to production project `yeflmlcpqdfsfjlxofqy`; the dry run identified only this migration.

Before the interruption, TypeScript and the production build passed. Lint reported zero errors and 41 existing warnings. The full test run found one review-note wording assertion, which was corrected and its seven-test suite then passed.

The actual production build running locally against the marked fictional reviewer fixture passed authenticated API checks for refusal, grant, withdrawal, stale/malformed choices, owner isolation, direct database access denial, all four community API operations, and consultation submission with a deterministic summary while AI was off. Consultation fields were restored afterward. No real client's coaching data was changed.

Mobile browser verification at 390×844 confirmed that refusal persists, the disclosure and choices are readable without horizontal overflow, and explicit opt-in unlocks chat. The Mac/app interruption happened before the AI response and final withdrawal UI were verified. The fictional review account was explicitly restored to AI off after recovery.

After recovery, all 283 tests passed using `tsx --test --test-concurrency=1`, with a 1GB Node heap cap. The Astra autoreview completed successfully with no findings (`autoreview --mode local`, current ChatGPT-app CLI; optional connector/plugin workers disabled for that subprocess). Earlier attempts with older installed CLIs failed because they did not support Astra; those failures were tooling failures, not review findings. No code changes were needed after the clean review.

Production is live at https://app.onlinegordy.com with code `fce152ff8b8b706ba90cfeef57c0b99fdd030e18`, deployment `dpl_GekjtZQwzVQZ3fWUoWFFuyAqijkb`. Vercel confirms READY, the canonical production alias and the exact Git revision. The hosted build passed.

Production verification completed after recovery:

- The real authenticated API checks passed for unauthenticated/stale/malformed choices, owner-scoped grant (including forged owner fields), withdrawal, direct database access denial, all four disabled community operations, and consultation submission with AI off. Fictional consultation fields were restored and permission was left off.
- The live browser showed the disclosure, accepted explicit opt-in and returned a successful AI summary of the fictional client's assigned training. Settings withdrawal persisted; reopening AI returned to the opt-in screen.
- Existing private DMs loaded with AI off. Group chat was absent from navigation, and its direct page displayed 404. No message was sent to Gordy or another person during testing.
- Pre-crash mobile visual verification covered refusal, consent copy and buttons at 390×844 without horizontal overflow. The interrupted AI-response/withdrawal checks were completed on the live deployment after recovery.

The source is on `codex/whoop-data-investigation`. These corrections have not been merged into `main`; preserve this deployed revision when preparing any subsequent main-based deployment. No additional local build/review/test processes were left running.

## iPhone walkthrough and submission

Kevin's confirmation of the completed walkthrough supersedes the assumption that old unchecked checklist entries meant it had not happened. Previously recorded Build 10 installation/sign-in and APNs acceptance remain independent supporting evidence. Do not repeat the entire walkthrough. Check only the newly changed consent flow and absence of deferred features on Build 10.

These changes are hosted web changes; they do not require a new native binary. The current App Store Connect session still needs to be reopened and checked against Build 10 and the revised review notes/privacy/age answers. Review current crash feedback and Gordy's listing approval before requesting submission. Historical App Store Connect settings are dated 26 August, not current verification. No Apple submission has been performed or authorized by this handover.


## Sign-in follow-up — 9 September

Kevin confirmed the consent screen looked fine, then reported iPhone focus zoom and accidental navigation on login. Login/reset inputs used 14px text outside the portal's existing 16px input rule. Updated all three inputs to 16px/48px controls, added associated labels and autofill/keyboard hints, and anchored the mobile form near the top so viewport-height changes do not recenter it. Improved secondary-control hit areas. At Kevin's follow-up, removed “Back to main site” and made the logo non-clickable; password-reset return remains.

Production is now code `c8828fb09936da17baac0a1538048cb9090a06c2`, deployment `dpl_EgeftpYMCscEb4sLPcnJ5BUvFG9Z`, READY with the canonical alias and exact Git revision verified. Existing consent/community/WHOOP corrections are included. TypeScript, targeted ESLint, the Vercel production build and scoped Astra autoreview pass. Local browser checks covered 390×844, a reduced 390×500 viewport with unchanged password position, desktop 1440×1000, password focus, reset/back navigation and zero console errors. Live browser checks confirmed 16px/48px fields, password focus, no website links and no horizontal overflow. Actual iPhone keyboard/zoom behavior still needs Kevin's quick retry after reopening the app; desktop viewport checks are not device proof. No reset email was sent and authentication behavior was not changed.

Removing a website exit improves the login experience, but Apple's Guideline 4.2 judges useful features/content/UI beyond a repackaged website. App Store Connect still requires a fresh authorized sign-in (and possibly two-factor approval) before submission; saved app/submission configuration was not removed by session expiry.


## App Store Connect verification — 9 September 2026

Kevin confirmed the new password/sign-in screen is good on his iPhone, following his earlier consent-screen confirmation. The focused device checks are complete; do not request another full walkthrough.

After Kevin reauthenticated, inspected the live Gordy-owned AT CAPACITY record (Apple ID 6805066999, bundle com.gordyelliott.atcapacity). Current verification supersedes the earlier expired-session hold:

- Version 1.0 remains Prepare for Submission, with Build 10 selected. The uploaded binary is Validated, iPhone-only, minimum iOS 15, team 5NU9323724, production APNs and Universal Links entitlements, and no non-exempt encryption.
- Six 6.5-inch screenshots are present: dashboard, training plan, active session, Daily Tracker, private DM and nutrition. Manual release remains selected; Mac and Vision Pro distribution are off.
- Free pricing is saved (£0.00 in the UK; zero prices across the displayed country table); 175 countries/regions available. Both Free and Paid Apps agreements and DSA compliance are Active.
- Published privacy label contains the expected 14 identity-linked data types and no tracking indication; both privacy URLs are correct. No privacy-label changes were needed.
- Saved age answers: messaging/chat Yes; social media No; broad-distribution UGC No; wellness Yes; medical/treatment None; profanity Infrequent; remaining mature/violence/gambling categories None/No; override 16+. The new social-media questions are answered. UGC No matches Apple's displayed definition of broad distribution now that group chat is deferred; private messaging is separately declared. Earlier prepared age-answer recommendations differ and should not overwrite these live answers blindly.
- Reviewer username/password and contact details are present, confirmed visually. Browser accessibility and DOM reads omit sensitive values even when populated; do not misdiagnose them as blank. The password was not changed or persisted in documents. This turn verified credential presence, not a fresh password-authentication attempt; prior fixture sign-in verification remains historical evidence.
- TestFlight Build 10 shows 2 installations and 85 sessions in the Last 7 Days field. Crashes and Feedback show dashes, meaning no entries shown, not proof that crashes are impossible. App Review has no submitted items or outstanding review correspondence.
- Updated and SAVED the version description to mention explicit optional AI-sharing permission. Updated and SAVED review notes describing default-off consent, recipients, withdrawal, ordinary functionality with AI off, WHOOP/Apple Health unavailability and deferred group chat, while retaining the detailed native-workout explanation. A separate fresh page load confirmed all changes persisted and Save was disabled. No Add for Review or submission action taken.

Remaining Apple account action: App Information shows an MRDP compliance banner. The existing Active declaration lists only the legacy Online Gordy app. In the wizard, selected AT CAPACITY in addition to Online Gordy and advanced to Confirm Information; **Done has NOT been clicked and this declaration change is NOT saved**. Apple asks the account holder to confirm the existing home-country tax information, with the TIN masked. Kevin or Gordy must verify that information before finalizing it. AT CAPACITY is the app name, not the business name: the Gordy business/account identity remains unchanged. Kevin explicitly clarified this distinction.

The in-app browser is left on that final confirmation screen. After the owner verifies the existing tax information and the declaration is finalized, check that the MRDP warning clears, then obtain separate authorization to add Build 10 for review and submit. Manual release means approval will not automatically publish the app. The current technical and metadata checks support proceeding once that account declaration is resolved; Apple retains the final review decision.

Official MRDP reference: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-information-for-model-reporting-rules-for-digital-platforms
Official new social-media questions: https://developer.apple.com/news/?id=tlur8uvi


## Submitted to Apple — 9 September 2026, 16:40 BST

Kevin explicitly authorized submission after completing the MRDP declaration himself; the compliance warning was verified cleared. Added version 1.0 Build 10 for review and clicked Submit for Review. Apple confirmed “1 Item Submitted”; the submission detail page independently shows **Waiting for Review**, item **1.0 (10)**, submitted by Kevin Harkin on 9 September 2026 at 16:40 BST.

Submission ID: `8aaa1329-49a9-48ee-a027-9083d3e6c64b`.
Submission URL: https://appstoreconnect.apple.com/apps/6805066999/distribution/reviewsubmissions/details/8aaa1329-49a9-48ee-a027-9083d3e6c64b

Manual release was confirmed selected immediately before submission and was not changed. Approval will require a later manual release; nothing has been published to the App Store. Apple's confirmation says review can take up to 48 hours and an email will follow; this is Apple's displayed guidance, not a guaranteed completion time.

The visible in-app browser tab is left on the Waiting for Review detail page, marked as a deliverable so Kevin can screenshot it for Gordy. No message or screenshot was sent to Gordy. No monitoring automation was requested or created. Next action: respond to Apple's review outcome when received, and obtain release authorization before publishing an approved version. Preserve the deployed feature-branch corrections during any later main integration.
