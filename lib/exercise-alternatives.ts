import type { Exercise, ExerciseSessionItem } from "@/lib/types";

export const ALTERNATIVE_RULE_VERSION = "movement-families-v1";
export type LibraryExercise = Pick<Exercise, "id" | "name" | "muscle_group" | "equipment" | "is_active"> & {description?:string|null};
export function exerciseEvidence(exercise: LibraryExercise) {
  return { name: exercise.name, muscle_group: exercise.muscle_group, equipment: exercise.equipment, description: exercise.description ?? null };
}
export function evidenceMatches(exercise: LibraryExercise, evidence: unknown) {
  const expected = exerciseEvidence(exercise);
  if (!evidence || typeof evidence !== "object") return false;
  return Object.entries(expected).every(([key, value]) => (evidence as Record<string, unknown>)[key] === value);
}

// Exact names audited against the live library. These are conservative movement/purpose
// families, not muscle-group similarity. Unlisted variations remain in the review queue.
// Laterality, body support, bench angle and distinct loading intent stay separate.
const FAMILIES: Array<[string, string, string, string, string[]]> = [
  ["decline-press", "bilateral", "decline chest press", "decline bench", ["Decline Bench Press", "Decline Dumbbell Press"]],
  ["upright-row", "bilateral", "upright shoulder and trap pull", "standing", ["Upright Row", "Upright Rows", "Cable Upright Row", "Kettlebell Upright Row"]],
  ["step-up", "unilateral", "forward loaded step-up", "box or step", ["Step-Ups", "Box Step-Up"]],
  ["floor-deadlift", "bilateral", "floor-start hip hinge strength", "standing", ["Deadlift", "Dumbbell Deadlift", "Kettlebell Deadlift"]],
  ["pull-through", "bilateral", "low-anchor hip hinge", "secure low anchor", ["Cable Pull Through", "Banded Pull Through", "Cable Pull Through With Rope"]],
  ["push-up", "bilateral", "floor bodyweight horizontal press", "floor", ["Push-Ups", "Push-Up", "Press Ups"]],
  ["chest-dip", "bilateral", "forward-lean chest dip", "parallel dip bars", ["Chest Dips", "Chest Dip"]],

  ["horizontal-press", "bilateral", "flat bench chest strength", "bench", ["Flat Bench Press", "Barbell Bench Press", "Bench Press", "Flat Bench Barbell Press", "Dumbbell Bench Press", "Flat Dumbbell Press", "Dumbbell Chest Press Flat", "Chest Press Machine", "Smith Machine Bench Press", "Smith Machine Flat Bench Press"]],
  ["incline-press", "bilateral", "incline upper chest strength", "incline bench", ["Incline Bench Press", "Barbell Incline Bench Press", "Incline Dumbbell Press", "Incline DB Press", "Dumbbell Incline Bench Press", "Dumbbell Chest Press Incline Bench", "Incline Chest Press Machine", "Smith Machine Incline Press"]],
  ["floor-press", "bilateral", "floor-limited chest press", "floor", ["Floor Press", "Dumbbell Floor Press", "db floor press", "Dumbbell Lying On Floor Chest Press"]],
  ["chest-fly", "bilateral", "horizontal chest isolation", "bench", ["Dumbbell Flyes", "Dumbbell Fly", "Pec Deck", "Pec Deck Fly", "Pec Deck Machine"]],
  ["standing-overhead-press", "bilateral", "strict overhead shoulder strength", "standing", ["Barbell Overhead Press", "Standing Barbell Press", "Barbell Standing Military Pres", "Barbell Standing Shoulder Pres", "Barbell Standing Shoulder Press", "Military Press", "Dumbbell Shoulder Press (standing)"]],
  ["seated-overhead-press", "bilateral", "seated overhead shoulder strength", "bench", ["Seated Barbell Press", "Seated Dumbbell Press", "Dumbbell Seated Shoulder Press", "Seated Dumbbell Shoulder Pres", "Machine Shoulder Press", "Shoulder Press Machine"]],
  ["lateral-raise", "bilateral", "shoulder abduction isolation", "standing", ["Lateral Raises", "Side Laterals (standing)", "Side Delt Raises", "Dumbbell Lat Raises", "Dumbbell Side Raises Standing", "Machine Lateral Raise"]],
  ["cable-lateral-raise", "unilateral", "cable shoulder abduction isolation", "standing", ["Cable Lateral Raise", "Cable Lateral Raises", "Cable Side Laterals"]],
  ["front-raise", "bilateral", "shoulder flexion isolation", "standing", ["Front Raises", "Dumbbell Front Raises Standing", "Frontal Rise", "Cable Front Raise"]],
  ["rear-delt-fly", "bilateral", "bent-over rear shoulder isolation", "hinged", ["Dumbbell Rear Delt Fly", "Dumbbell Reverse Fly", "Rear Delt Flyes", "Rear Delt Flys", "Rear delt fly", "Bent Over Rear Delt Fly Dumbbel", "Banded Bent Over Rear Lateral Raise"]],
  ["bilateral-bent-row", "bilateral", "unsupported horizontal back pull", "hinged", ["Barbell Row", "Barbell Bent-over Row", "Barbell Bent Over Row Pronated Grip", "Double Dumbbell Bent Over Row", "Dumbbell Bent Over Row", "Dumbbell Bent-Over Row", "Banded Bent Over Row"]],
  ["bench-single-row", "unilateral", "bench-supported horizontal back pull", "bench", ["Single-Arm Dumbbell Row", "Dumbbell Row", "Single Arm Dumbell Rows", "Dumbbells Single Arm Row", "Single Arm Bench Bent Over Row", "Single DB row"]],
  ["chest-supported-row", "bilateral", "supported horizontal back pull", "incline bench", ["Chest-Supported Row", "Chest Supported Back Row", "Dumbbell Hammer Grip Incline Bench Row", "Chest-Supported T-Bar Row"]],
  ["seated-cable-row", "bilateral", "seated horizontal back pull", "seated cable station", ["Seated Cable Row", "Cable Low Seated Row", "Low Cable Row", "Cable Row", "Mid Back Row"]],
  ["close-cable-row", "bilateral", "close-grip seated horizontal pull", "seated cable station", ["Close Grip Cable Row", "Low Row (narrow grip)", "Straight Bar Cable Row Close Grip"]],
  ["wide-pulldown", "bilateral", "wide pronated vertical pull", "lat pulldown station", ["Wide-Grip Lat Pulldown", "Lat Pull Down Wide Grip", "Cable Wide Grip Lat Pulldown"]],
  ["neutral-pulldown", "bilateral", "neutral-grip vertical pull", "lat pulldown station", ["Neutral-Grip Lat Pulldown", "Cable Neutral Grip Lat Pulldown"]],
  ["supinated-pulldown", "bilateral", "supinated vertical pull", "lat pulldown station", ["Reverse-Grip Lat Pulldown", "Lat Pulldown Supinated Grip", "Reverse Grip Machine Lat Pull-down"]],
  ["standard-pulldown", "bilateral", "standard vertical pull", "lat pulldown station", ["Lat Pulldown", "Lat Pull Down", "High Lat Pull Down"]],
  ["pull-up", "bilateral", "unassisted pronated bodyweight vertical pull", "pull-up bar", ["Pull-Ups", "Pull Up", "Pull-Up"]],
  ["chin-up", "bilateral", "unassisted supinated bodyweight vertical pull", "pull-up bar", ["Chin-Ups", "Chin-Up"]],
  ["assisted-pull-up", "bilateral", "machine-assisted vertical pull", "assisted pull-up machine", ["Assisted Pull-Up", "Assisted Pull Ups"]],
  ["standing-curl", "bilateral", "supinated elbow flexion", "standing", ["Barbell Curl", "Barbell Curls", "EZ-Bar Curl", "Dumbbell Curl", "Dumbbell Curls", "Bicep Curls", "Dumbbell Biceps Curl", "Dumbbell Standing Simultaneous Biceps Curl", "Cable Curl", "Cable Bicep Curls", "Biceps Curl Cable", "Standing Biceps Cable Curl", "Band Bicep Curl"]],
  ["hammer-curl", "bilateral", "neutral-grip elbow flexion", "standing", ["Hammer Curl", "Hammer Curls", "Dumbbell Hammer Curl", "Rope Hammer Curl"]],
  ["seated-curl", "bilateral", "seated supinated elbow flexion", "bench", ["Dumbbell Seated Curl", "Seated DB Curls"]],
  ["concentration-curl", "unilateral", "braced elbow flexion", "bench", ["Concentration Curl", "Concentration Curls"]],
  ["triceps-pushdown", "bilateral", "arms-at-side elbow extension", "standing", ["Tricep Pushdown", "Tricep Push Downs", "Cable Tricep Pushdown", "Cable Triceps Pushdown", "Cable Press Down", "Cable Push Down", "Tricep Cable Push", "Rope Tricep Pushdown", "Banded Triceps Pushdown"]],
  ["lying-triceps-extension", "bilateral", "lying elbow extension", "bench", ["Skull Crushers", "EZ-Bar Skullcrusher", "Dumbbell Skullcrusher", "Dumbbell Lying Triceps Extension"]],
  ["overhead-triceps-extension", "bilateral", "overhead elbow extension", "standing", ["Overhead Cable Tricep Extension", "Dumbbell Overhead Triceps Extension", "Overhead Tricep Extension", "Band Overhead Tricep Extension"]],
  ["goblet-squat", "bilateral", "goblet-loaded squat", "standing", ["Goblet Squat", "Dumbbell Goblet Squat", "Kettlebell Goblet Squat", "Goblet Kettlebell Squats"]],
  ["back-squat", "bilateral", "barbell back squat", "squat rack", ["Back Squat", "Back Squats"]],
  ["front-squat", "bilateral", "barbell front-rack squat", "squat rack", ["Front Squat", "Front Squats", "Barbell Front Squat"]],
  ["air-squat", "bilateral", "unloaded squat", "standing", ["Air Squat", "Air Squats", "Bodyweight Squats"]],
  ["romanian-deadlift", "bilateral", "soft-knee hip hinge without floor reset", "standing", ["Romanian Deadlift", "Barbell Romanian Deadlift", "Barbell RDL", "RDL'S", "Dumbbell Romanian Deadlift", "DB Glute RDL", "Kettlebell Romanian Deadlift", "Banded Rdl"]],
  ["single-leg-rdl", "unilateral", "single-leg hip hinge", "standing", ["Single-Leg Romanian Deadlift", "Dumbbell Single Leg Deadlift"]],
  ["hip-thrust", "bilateral", "bench-supported hip extension", "bench", ["Hip Thrust", "Barbell Hip Thrust", "Barbell Hip Thrusts", "Dumbbell Hip Thrust", "Smith Machine Hip Thrust", "Glute Drive Machine"]],
  ["glute-bridge", "bilateral", "floor hip extension", "floor", ["Glute Bridge", "Dumbbell Glute Bridge", "Barbell Glute Bridge"]],
  ["static-split-squat", "unilateral", "stationary split-stance squat", "standing", ["Split Squat", "Dumbbell Split Squat", "Dumbbell Static Lunge", "Dumbbell Single Leg Split Squat"]],
  ["bulgarian-split-squat", "unilateral", "rear-foot-elevated split squat", "bench", ["Bulgarian Split Squat", "Bulgarian Splits", "Dumbbell Bulgarian Split Squat", "Dumbbell Bulgarian Box Split Squat"]],
  ["reverse-lunge", "unilateral", "backward stepping lunge", "standing", ["Reverse Lunge", "Reverse Lunges", "Reverse lunge with weigths", "Dumbbell Reverse Lunge On The Spot", "Body Weight Reverse Lunge", "Bodyweight Rear Lunge"]],
  ["walking-lunge", "unilateral", "continuous forward stepping lunge", "clear walking space", ["Walking Lunge", "Walking Lunges", "Dumbbell Walking Lunges", "DB Walking Lunge", "DB Walking Lunges"]],
  ["lying-leg-curl", "bilateral", "prone knee flexion isolation", "lying leg curl machine", ["Lying Hamstring Curl", "Laying Hamstring Curl", "Lying Leg Curl"]],
  ["seated-leg-curl", "bilateral", "seated knee flexion isolation", "seated leg curl machine", ["Seated Hamstring Curl", "Seated Hamstring Curls"]],
  ["leg-extension", "bilateral", "seated knee extension isolation", "leg extension machine", ["Leg Extension", "Leg Extension Machine", "Leg Extensions"]],
  ["standing-calf", "bilateral", "straight-knee plantarflexion", "standing", ["Standing Calf Raise", "Barbell Standing Leg Calf Raise", "Dumbbell Calve Raise", "Bodyweight Calf Raises", "Smith Machine Calf Raises"]],
  ["seated-calf", "bilateral", "bent-knee plantarflexion", "seated calf machine", ["Seated Calf Raise", "Bent Knee Calf Raise"]],
  ["hip-abduction", "bilateral", "seated hip abduction isolation", "hip abduction machine", ["Machine Hip Abduction", "Seated Hip Abduction", "Abductors"]],
  ["shrug", "bilateral", "standing shoulder elevation", "standing", ["Barbell Shrug", "Dumbbell Shrug", "Shrugs", "DB Shrugs"]],
  ["face-pull", "bilateral", "face-height pull and external rotation", "standing", ["Face Pulls", "Band Face Pull", "Resistance Band Face Pul"]],
];

const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
export function classifyExercise(exercise: LibraryExercise) {
  const family = FAMILIES.find(([, , , , names]) => names.some(name => normalized(name) === normalized(exercise.name)));
  if (!family || !exercise.is_active || /advanced|rehab|injur|rehabilitat/i.test(exercise.description || "")) return null;
  const [pattern, laterality, purpose, support] = family;
  return { pattern, laterality, purpose, support, difficulty: "not rated — select a fresh load", evidence: exerciseEvidence(exercise), rule_version: ALTERNATIVE_RULE_VERSION };
}
export function equipmentNeeded(exercise: LibraryExercise, support: string) {
  const items = [exercise.equipment.toLowerCase() === "machine" ? /machine$/i.test(exercise.name) ? exercise.name : `${exercise.name} machine` : exercise.equipment.toLowerCase()];
  if (!["standing", "floor"].includes(support) && exercise.equipment.toLowerCase() !== "machine") items.push(support);
  if (exercise.equipment === "band" && /pushdown|extension|face.pull|bent.*row/i.test(exercise.name)) items.push("secure band anchor");
  // 'none' in this library can mean sled/rope etc. Never auto-enable these.
  return [...new Set(items)];
}
export function generateAlternatives(exercises: LibraryExercise[]) {
  const profiles = exercises.map(exercise => ({ exercise, metadata: classifyExercise(exercise) }));
  const mappings = profiles.flatMap(source => {
    if (!source.metadata) return [];
    const seen = new Set([normalized(source.exercise.name)]);
    return profiles.filter(target => target.metadata?.pattern === source.metadata!.pattern && target.exercise.id !== source.exercise.id)
      // Do not introduce barbell skill or move a guided-machine prescription to free weights automatically.
      .filter(target => !(target.exercise.equipment === "barbell" && source.exercise.equipment !== "barbell") && !(source.exercise.equipment === "machine" && target.exercise.equipment !== "machine"))
      .sort((a, b) => Number(a.exercise.equipment === source.exercise.equipment) - Number(b.exercise.equipment === source.exercise.equipment) || a.exercise.name.localeCompare(b.exercise.name) || a.exercise.id.localeCompare(b.exercise.id))
      .filter(target => { const name = normalized(target.exercise.name); if (seen.has(name)) return false; seen.add(name); return true; })
      .slice(0, 3).map(target => ({ source_exercise_id: source.exercise.id, alternative_exercise_id: target.exercise.id,
        status: "generated", source_evidence: source.metadata!.evidence, target_evidence: target.metadata!.evidence,
        rationale: `${source.metadata!.purpose}; ${source.metadata!.laterality}; ${source.metadata!.support}. Load is not transferable.`,
        required_equipment: equipmentNeeded(target.exercise, target.metadata!.support), rule_version: ALTERNATIVE_RULE_VERSION }));
  });
  return { profiles, mappings };
}
export function itemAllowsSwap(item: Pick<ExerciseSessionItem, "prescription_type"> & {notes?:string|null;tempo?:string|null}) {
  // Time/distance/circuit targets and exercise-specific coaching cues cannot be copied safely.
  return (!item.prescription_type || item.prescription_type === "sets_reps") && !item.notes?.trim() && !item.tempo?.trim();
}
