import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyExercise, generateAlternatives, evidenceMatches, exerciseEvidence, itemAllowsSwap, equipmentNeeded, type LibraryExercise } from '../lib/exercise-alternatives';
const exercise=(name:string,equipment='dumbbell',description:string|null=null):LibraryExercise=>({id:name,name,equipment,description,muscle_group:'legs',is_active:true});
test('movement purpose precedes muscle: goblet squat maps to kettlebell goblet, not hinge, jump, elevated heels or split squat',()=>{
 const library=[exercise('Goblet Squat'),exercise('Kettlebell Goblet Squat','kettlebell'),exercise('Romanian Deadlift','barbell'),exercise('Squat Jump','bodyweight'),exercise('Heels-Elevated Goblet Squat'),exercise('Dumbbell Split Squat')];
 assert.deepEqual(generateAlternatives(library).mappings.filter(m=>m.source_exercise_id==='Goblet Squat').map(m=>m.alternative_exercise_id),['Kettlebell Goblet Squat']);
});
test('separates laterality, support, bench angle and range',()=>{
 const names=['Dumbbell Bench Press','Incline Dumbbell Press','Dumbbell Floor Press','Alternating Dumbbell Bench Press','Dumbbell Bent-Over Row','Single-Arm Dumbbell Row','Chest-Supported Row','Romanian Deadlift','Single-Leg Romanian Deadlift','Deadlift'];
 const patterns=names.map(name=>classifyExercise(exercise(name))?.pattern);
 assert.equal(new Set(patterns).size,names.length);
 assert.equal(classifyExercise(exercise('Single-Arm Dumbbell Row'))?.laterality,'unilateral');
 assert.equal(classifyExercise(exercise('Chest-Supported Row'))?.support,'incline bench');
});
test('unknown, inactive and advanced entries stay unavailable; name substring cannot override specialist variation',()=>{
 for(const name of ['Mystery legs','Guillotine Press','Kettlebell Bottoms-Up Press','Barbell 21s','Modified Side Plank']) assert.equal(classifyExercise(exercise(name)),null);
 assert.equal(classifyExercise({...exercise('Goblet Squat'),is_active:false}),null);
 assert.equal(classifyExercise(exercise('Goblet Squat','dumbbell','Advanced rehabilitation variation')),null);
});
test('evidence invalidates changed names, equipment and instructions',()=>{
 const original=exercise('Goblet Squat','dumbbell','Hold at chest');const evidence=exerciseEvidence(original);
 assert.equal(evidenceMatches(original,evidence),true);
 for(const changed of [{name:'Heels elevated squat'},{equipment:'kettlebell'},{description:'Partial range only'}]) assert.equal(evidenceMatches({...original,...changed},evidence),false);
});
test('equipment includes supports and named machines, not generic machine availability',()=>{
 assert.deepEqual(equipmentNeeded(exercise('Dumbbell Bench Press'),'bench'),['dumbbell','bench']);
 assert.deepEqual(equipmentNeeded(exercise('Chest Press Machine','machine'),'bench'),['Chest Press Machine']);
 assert.deepEqual(equipmentNeeded(exercise('Banded Triceps Pushdown','band'),'standing'),['band','secure band anchor']);
});
test('prescription-specific cues and timed targets do not inherit substitutions',()=>{
 assert.equal(itemAllowsSwap({prescription_type:'sets_reps',notes:null,tempo:null}),true);
 for(const value of [{prescription_type:'time' as const},{notes:'Pain-free depth only'},{tempo:'31X1'}]) assert.equal(itemAllowsSwap({prescription_type:'sets_reps',notes:null,tempo:null,...value}),false);
});
test('few directional suggestions, active targets, distinct names and stable provenance',()=>{
 const library=['Flat Bench Press','Dumbbell Bench Press','Flat Dumbbell Press','Chest Press Machine','Smith Machine Bench Press'].map(name=>exercise(name));
 const mappings=generateAlternatives(library).mappings;
 assert.equal(mappings.filter(m=>m.source_exercise_id==='Flat Bench Press').length,3);
 assert.ok(mappings.every(m=>m.status==='generated'&&m.rule_version==='movement-families-v1'&&m.rationale.includes('Load is not transferable')));
});

test('unknown difficulty never introduces a barbell or moves guided machine prescriptions to free weights',()=>{
 const mappings=generateAlternatives([exercise('Flat Bench Press','barbell'),exercise('Dumbbell Bench Press','dumbbell'),exercise('Chest Press Machine','machine')]).mappings;
 assert.equal(mappings.some(m=>m.source_exercise_id==='Dumbbell Bench Press'&&m.alternative_exercise_id==='Flat Bench Press'),false);
 assert.equal(mappings.some(m=>m.source_exercise_id==='Chest Press Machine'&&m.alternative_exercise_id==='Dumbbell Bench Press'),false);
 assert.equal(mappings.some(m=>m.source_exercise_id==='Flat Bench Press'&&m.alternative_exercise_id==='Dumbbell Bench Press'),true);
});
