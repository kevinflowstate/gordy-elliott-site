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
