// Usage: npx tsx scripts/generate-exercise-alternatives.ts <audited-library.json> <output.sql>
// Input is a fresh id/name/muscle_group/equipment/description/is_active library export, never client data.
import { readFileSync, writeFileSync } from "node:fs";
import { generateAlternatives } from "../lib/exercise-alternatives";
const exercises=JSON.parse(readFileSync(process.argv[2],'utf8'));
const {profiles,mappings}=generateAlternatives(exercises);
const literal=(value:unknown)=>"'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
const profileRows=profiles.map(p=>`(${literal(p.exercise.id)},${p.metadata?literal(p.metadata)+'::jsonb':'null'},'movement-families-v1')`);
const mappingRows=mappings.map(m=>`(${literal(m.source_exercise_id)},${literal(m.alternative_exercise_id)},'generated',${literal(m.source_evidence)}::jsonb,${literal(m.target_evidence)}::jsonb,${literal(m.rationale)},ARRAY[${m.required_equipment.map(literal).join(',')}],${literal(m.rule_version)})`);
writeFileSync(process.argv[3],`-- Audited library snapshot; exact-name movement rules, never inferred injury suitability.\nINSERT INTO public.exercise_swap_profiles(exercise_id,metadata,rule_version) VALUES\n${profileRows.join(',\n')}\nON CONFLICT(exercise_id) DO NOTHING;\nINSERT INTO public.exercise_alternatives(source_exercise_id,alternative_exercise_id,status,source_evidence,target_evidence,rationale,required_equipment,rule_version) VALUES\n${mappingRows.join(',\n')}\nON CONFLICT(source_exercise_id,alternative_exercise_id) DO NOTHING;\n`);
console.log(JSON.stringify({library:profiles.length,classified:profiles.filter(p=>p.metadata).length,enabled:new Set(mappings.map(m=>m.source_exercise_id)).size,links:mappings.length,unavailable:profiles.length-new Set(mappings.map(m=>m.source_exercise_id)).size}));
