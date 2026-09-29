import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseKahunasPreviewClient, validateKahunasPreviewClients } from "../lib/kahunas-preview-import";

const fixture = `# Jane Smith

| Field | Value |
|---|---|
| Tier | CAPACITY |
| Login email | JANE@example.com (confirmed) |
| Check-in day | Monday |
| Kahunas start weight | 154 lb |
| Latest check-in weight | 68 kg (2026-09-20) |

## Macros (Kahunas nutrition plan "Day 1")

| Calories | Protein | Carbs | Fat |
|---|---|---|---|
| 1800 kcal | 140 g | 170 g | 55 g |

## Current training plan — "Jane Strength" (last logged 2026-09-20)

### Session 1 - Full Body
| # | Exercise | Sets | Reps | RIR | Rest | Notes |
| --- | --- | --- | --- | --- | --- | --- |
**Warm Up**
| A | 90/90 | | | | | Time 2 min 0 sec |
**Workout**
| B1 (superset) | Goblet Squat | 3 | 10 | 2 | 1 min 15 sec | Controlled |
| C | Bike | 1 | AMRAP 12 min | | | |
| D | Circuit | 1 | 5 rounds in 10 min | | | |
| E | Plank | 1 | 2 min 30 sec | | | |
| F | Row | 1 | 500m | | | |
| G | Run | 1 | 5km | | | Outside
| H | Intervals | 1 | 30 sec on / 30 sec off | | | |

## Flags
- **Review knee pain.**

## Consultation form (JotForm, verbatim)

**'The Future' - What are your Goals?**
Build strength and consistency.
`;

test("parses a frozen-preview client without inventing missing data", () => {
  const client = parseKahunasPreviewClient("migration/capacity/jane-smith.md", fixture);
  assert.equal(client.name, "Jane Smith");
  assert.equal(client.email, "jane@example.com");
  assert.equal(client.programme, "capacity");
  assert.equal(client.profile.experience_mode, "founder_dashboard");
  assert.equal(client.profile.tier, "vip");
  assert.equal(client.startWeightKg, 69.9);
  assert.equal(client.latestWeightKg, 68);
  assert.equal(client.latestWeightDate, "2026-09-20");
  assert.deepEqual(client.macros, { calories: 1800, protein: 140, carbs: 170, fat: 55 });
  assert.equal(client.trainingPlanName, "Jane Strength");
  assert.equal(client.sessions[0].exercises.length, 8);
  assert.equal(client.sessions[0].exercises[0].sectionLabel, "Warm Up");
  assert.equal(client.sessions[0].exercises[0].prescriptionType, "time");
  assert.equal(client.sessions[0].exercises[0].prescriptionText, "2 min 0 sec");
  assert.equal(client.sessions[0].exercises[1].supersetGroup, "B");
  assert.equal(client.sessions[0].exercises[1].restSeconds, 75);
  assert.match(client.sessions[0].exercises[1].notes || "", /RIR: 2/);
  assert.equal(client.sessions[0].exercises[2].prescriptionType, "amrap");
  assert.equal(client.sessions[0].exercises[2].prescriptionText, "AMRAP 12 min");
  assert.equal(client.sessions[0].exercises[3].prescriptionType, "rounds");
  assert.equal(client.sessions[0].exercises[3].prescriptionText, "5 rounds in 10 min");
  assert.equal(client.sessions[0].exercises[4].prescriptionType, "time");
  assert.equal(client.sessions[0].exercises[4].prescriptionText, "2 min 30 sec");
  assert.equal(client.sessions[0].exercises[5].prescriptionType, "distance");
  assert.equal(client.sessions[0].exercises[6].prescriptionType, "distance");
  assert.equal(client.sessions[0].exercises[6].notes, "Outside");
  assert.equal(client.sessions[0].exercises[7].prescriptionType, "time");
  assert.equal(client.sessions[0].exercises[7].prescriptionText, "30 sec on / 30 sec off");
  assert.deepEqual(client.flags, ["Review knee pain."]);
  assert.equal(client.consultationData.primary_goal, "Build strength and consistency.");
  assert.deepEqual(validateKahunasPreviewClients([client]), []);
});

test("programme folders are recognised with or without a parent directory", () => {
  assert.equal(parseKahunasPreviewClient("capacity/jane.md", fixture).programme, "capacity");
  assert.equal(parseKahunasPreviewClient("migration/in-person/jane.md", fixture).programme, "in_person");
  assert.equal(parseKahunasPreviewClient("shift/jane.md", fixture).programme, "shift");
});

test("programme folder and declared Tier must agree", () => {
  const unknown = parseKahunasPreviewClient("clients/jane.md", fixture);
  const mismatch = parseKahunasPreviewClient("shift/jane.md", fixture);
  assert.ok(validateKahunasPreviewClients([unknown]).some((issue) => issue.includes("programme folder")));
  assert.ok(validateKahunasPreviewClients([mismatch]).some((issue) => issue.includes("programme folder")));
  assert.deepEqual(validateKahunasPreviewClients([]), ["Archive contains no Markdown client files."]);
});

test("live importer is frozen, explicit, and contains no outbound email path", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/import-kahunas-preview.mjs"), "utf8");
  assert.match(source, /confirm !== "FROZEN_PREVIEW_IMPORT"/);
  assert.match(source, /lifecycle_status: "access_frozen"/);
  assert.match(source, /requires_password_setup: true/);
  assert.match(source, /ban_duration: "876000h"/);
  assert.match(source, /@clients\.invalid/);
  assert.match(source, /primary_goal: client\.consultationData\.primary_goal/);
  assert.match(source, /prescription_type: exercise\.prescriptionType/);
  assert.doesNotMatch(source, /client_body_measurements"\)\.upsert/);
  assert.doesNotMatch(source, /client_monitoring_preferences/);
  assert.match(source, /CLEANUP FAILED/);
  assert.match(source, /Emergency freeze/);
  assert.match(source, /\.range\(from, from \+ pageSize - 1\)/);
  assert.doesNotMatch(source, /sendWelcomeEmail|sendPasswordResetEmail|generateLink/);
  assert.doesNotMatch(source, /from\("notifications"\)\.insert/);
});

test("password reset returns generically before generating a link for frozen clients", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/api/auth/password-reset/route.ts"), "utf8");
  const frozenGuard = source.indexOf('=== "access_frozen"');
  const linkGeneration = source.indexOf("generateLink");
  assert.ok(frozenGuard > 0);
  assert.ok(linkGeneration > frozenGuard);
  assert.match(source.slice(frozenGuard, linkGeneration), /return NextResponse\.json\(GENERIC_RESPONSE\)/);
});

test("preview activation is explicit, single-client, and sends no email", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/activate-kahunas-preview-client.mjs"), "utf8");
  assert.match(source, /ACTIVATE_FROZEN_PREVIEW/);
  assert.match(source, /preview_import_frozen === true/);
  assert.match(source, /lifecycle_status !== "access_frozen"/);
  assert.match(source, /ban_duration: "none"/);
  assert.match(source, /email_confirm: true/);
  assert.match(source, /onboarding_status: "active"/);
  assert.match(source, /setupEmailSent: false/);
  assert.match(source, /catch \(error\)/);
  assert.match(source, /preview_activation_pending: true/);
  assert.match(source, /preview_activation_pending: false/);
  assert.match(source, /rerun to resume/);
  assert.doesNotMatch(source, /sendWelcomeEmail|sendPasswordResetEmail|generateLink/);
});
