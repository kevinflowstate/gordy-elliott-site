# Google OAuth verification response

**Project number:** 935722768552  
**Project ID:** `at-capacity-503314`

## Reply to the Third Party Data Safety Team

Hello Third Party Data Safety Team,

Thank you for the review. We have addressed the requested AI integration and privacy-policy items for project 935722768552 (`at-capacity-503314`).

Updated privacy policy:

https://app.onlinegordy.com/privacy

The policy now expressly states:

- the Google Calendar data the application accesses;
- how that data is used;
- the service providers and people to whom that data is disclosed;
- the retention and deletion process;
- that neither raw nor derived Google Calendar data is sent to an AI/ML provider or used to train, fine-tune or improve a generalized AI/ML model; and
- the following affirmative Limited Use statement: “AT CAPACITY’s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.”

We have also added a just-in-time disclosure immediately before the Google Calendar connection action. It explains that the application requests read-only calendar access, describes the deterministic Capacity Checker and Storm Warning uses, identifies the relevant service providers, and states that Google Calendar data is not sent to Anthropic, OpenRouter or any downstream AI model.

### Data isolation

Google Calendar data follows this isolated path:

1. Composio provides the OAuth connection and calendar synchronisation.
2. The application processes the synchronised event metadata using deterministic application code for calendar load, Capacity Checker and Storm Warning calculations.
3. Supabase stores the synchronised data for the signed-in client, and Vercel hosts the application.
4. Google Calendar data is not included in prompts, embeddings, retrieval documents or API requests sent to any AI/ML provider.

We added automated release checks which verify that calendar database tables are excluded from all AI routes, that the calendar-derived coaching features remain deterministic, and that OpenRouter requests enforce Zero Data Retention.

### Complete list of third-party AI integrations

**Anthropic**

- Service: Anthropic Commercial API
- Plan/tier: pay-as-you-go API account
- Models used: `claude-haiku-4-5-20251001` and `claude-sonnet-4-20250514`
- Use: coaching and consultation features using non-Google application data
- Google Workspace data: not transferred to Anthropic
- Training configuration: Anthropic states that commercial API inputs and outputs are not used to train its generative models by default

**OpenRouter**

- Service: OpenRouter API multi-model gateway
- Plan/tier: pay-as-you-go
- Downstream models:
  - OpenAI `gpt-4o-mini`
  - OpenAI `text-embedding-3-small`
- Use: coaching responses and application-owned knowledge-base embeddings using non-Google application data
- Google Workspace data: not transferred to OpenRouter or either downstream model
- Training and retention configuration:
  - paid endpoints that train on request data are disabled;
  - the optional data-use discount is disabled;
  - every application request includes OpenRouter’s `provider.zdr: true` payload setting; and
  - OpenRouter therefore restricts routing to endpoints that support Zero Data Retention. The configured models have compatible Azure-hosted ZDR endpoints.

Composio is used for OAuth connection and calendar synchronisation. It is not used as an AI/ML model provider, and no AI/ML processing is performed on the Google Calendar data.

The updated application and privacy policy have been submitted again in Cloud Console. Please continue the verification review.

Kind regards,

Kevin Harkin  
Flowstate Systems Ltd  
kevin@flowstatesystems.ai

## Submission note

Do not send the final paragraph claiming resubmission until the production deployment is live and the Cloud Console verification request has actually been saved and resubmitted.
