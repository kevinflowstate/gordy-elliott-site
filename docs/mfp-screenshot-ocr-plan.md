# MyFitnessPal Screenshot OCR Plan

## Current State

- AI routes use `ANTHROPIC_API_KEY` with the Anthropic Messages API for text-only SHIFT AI and admin nutrition generation.
- There is no existing screenshot upload/storage path for nutrition entries.
- There is no existing OCR or vision utility that can safely extract structured macro totals today.
- The nutrition page already stores structured totals through `client_quick_meals` using the `MyFitnessPal totals` entry name.

## Implementation Contract

The OCR feature should only ship when it can return structured totals:

```ts
{
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
```

Failure copy: `Couldn't read totals, enter manually.`

## Proposed Endpoint

`POST /api/portal/mfp-screenshot-ocr`

- Requires authenticated portal user.
- Accepts `multipart/form-data` with one image field, max 8 MB.
- Validates MIME type as `image/png`, `image/jpeg`, or `image/webp`.
- Validates the uploaded bytes against the claimed file type:
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - JPEG: `FF D8 FF`
  - WebP: `RIFF....WEBP`
- Rejects files where the MIME type, extension, and magic bytes do not agree.
- Enforces image dimension limits after decode, for example:
  - Minimum useful size: 320 px wide and 320 px tall.
  - Maximum decode size: 4096 px on either side.
  - Maximum total pixels: 12 megapixels.
- Enforces request/file-size limits before decode and again after any server-side processing.
- Decodes server-side with a trusted image library and re-encodes to a safe PNG or JPEG before sending to any provider.
- Strips EXIF, GPS, ICC, and other metadata during the decode/re-encode step.
- Applies per-user rate limiting, for example 5 OCR attempts per 10 minutes and 30 per day, with audit logging of attempt counts only.
- Calls a configured vision-capable model.
- Requires JSON-only output matching the totals schema.
- Returns `{ totals }` on success.
- Returns `{ error: "Couldn't read totals, enter manually." }` with `422` when extraction is uncertain or incomplete.
- Does not store the raw screenshot unless a future storage/audit requirement is explicitly added.

## Provider Privacy Contract

- The UI must make clear that the screenshot can be sent to a third-party OCR/vision provider for extraction.
- The endpoint must document the provider used, its retention policy, and whether images are used for training.
- Use provider settings that disable training and minimize retention wherever available.
- Do not log raw image bytes, base64 payloads, extracted full-screen text, or provider responses that could include private data.
- If a provider has non-zero retention, include consent copy before upload and link to the provider privacy terms.
- Prefer sending the re-encoded image only, not the original upload, so metadata never leaves the server.

## UI Contract

- Keep manual MFP totals as the default.
- Add an optional "Read screenshot" control only after the endpoint exists.
- On success, prefill the existing MFP totals form with the extracted values so the user can confirm before saving.
- On failure, leave existing manual fields untouched and show `Couldn't read totals, enter manually.`
- Do not expose OCR UI unless all of these exist:
  - Authenticated endpoint.
  - MIME, magic-byte, size, dimension, decode/re-encode, metadata stripping, and rate-limit validation.
  - Fixture tests with realistic MyFitnessPal screenshots and invalid/corrupt image cases.

## Follow-Up Needed

- Choose and configure a vision-capable provider/env var.
- Add endpoint validation and rate-limit tests.
- Add fixture tests with at least one realistic MFP screenshot, one wrong MIME/magic-byte pair, one oversized image, one corrupt image, and one no-macro screenshot.
