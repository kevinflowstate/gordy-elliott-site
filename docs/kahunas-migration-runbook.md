# Kahunas client handover — preview runbook

This process is deliberately split into two stages. The preview stage validates Gordy's handover workbook and never creates accounts, uploads files or writes to Supabase. A real import remains a separate, reviewed operation.

## What Gordy supplies

1. One completed row per client in `AT-CAPACITY-Kahunas-Client-Handover.xlsx`.
2. One private Google Drive folder per client.
3. Whatever Kahunas allows him to export. If an item cannot be exported, a clear screenshot or saved PDF is acceptable.

The client folder should contain as much of the following as Kahunas makes available:

- client profile or consultation;
- current training plan and exercise prescriptions;
- workout history;
- check-ins and trackers;
- measurements and progress photos;
- nutrition plan or targets;
- useful client documents.

Blank optional fields are acceptable. Never invent missing coaching or health information; write what is missing in the final workbook column instead.

## Run the safe preview

```bash
npm run migration:preview -- \
  --input /absolute/path/AT-CAPACITY-Kahunas-Client-Handover.xlsx \
  --output /tmp/at-capacity-kahunas-preview.json
```

The command checks the template, required values, programme names, dates, duplicate emails and Drive folder links. Its report contains `mode: DRY_RUN_ONLY`. The script rejects `--apply`, `--commit` and `--import` flags.

## Review gate before any real import

- Resolve every error in the preview report.
- Manually inspect each private Drive folder and record missing material.
- Confirm the destination programme for every client: SHIFT, CAPACITY or IN PERSON.
- Decide how historical workouts, check-ins, measurements and photos map into AT CAPACITY.
- Test that mapping against one agreed demo client in a non-production rehearsal.
- Obtain Kevin's explicit approval for any account creation, production write or client invitation.

No migration should send invitations until the imported account and coaching data have been checked by Gordy.
