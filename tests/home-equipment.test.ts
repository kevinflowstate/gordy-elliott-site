import test from 'node:test';import assert from 'node:assert/strict';
import {HOME_EQUIPMENT_FIELD,homeTrainingSelected,withHomeEquipmentQuestion,savedHomeEquipmentDetails,homeEquipmentTrainingContext} from '../lib/home-equipment';
import {normalizeConsultationConfig} from '../lib/consultation-form';import {validateConsultationAnswers} from '../lib/boardroom-consultation';import type{FormQuestion}from'../lib/types';
const location:FormQuestion={id:'equipment_access',type:'select',label:'Equipment access',placeholder:'',enabled:true,options:['Full Gym','Home Gym','Home + Gym']};
test('Home selected directly, in combined location or a multi-value selection; gym-only stays hidden',()=>{
 for(const value of ['Home','Home Gym','home + gym','Gym; Home',['Gym','Home']]) assert.equal(homeTrainingSelected({equipment_access:value}),true);
 assert.equal(homeTrainingSelected({training_location:'Gym and home'}),true);
 for(const value of ['Full Gym','Limited','Bodyweight Only','No home access','Not at home','']) assert.equal(homeTrainingSelected({equipment_access:value}),false);
 assert.equal(homeTrainingSelected({additional_info:'I work from home'}),false);
});
test('adds one field after existing location without duplicating or replacing configured questions',()=>{
 const questions=withHomeEquipmentQuestion([location]);assert.equal(questions[1].id,HOME_EQUIPMENT_FIELD);assert.match(questions[1].placeholder,/2 × 5kg, 2 × 10kg/);
 assert.equal(withHomeEquipmentQuestion(questions).length,2);
 const custom={...questions[1],label:'My inventory',placeholder:'Coach wording'};assert.equal(withHomeEquipmentQuestion([location,custom])[1].label,'My inventory');
 assert.deepEqual(withHomeEquipmentQuestion([{...location,options:['Full Gym']}]),[{...location,options:['Full Gym']}]);
});
test('shared and Foundations loaded configs gain inventory; Boardroom retains its business-only form',()=>{
 for(const programme of ['shift','capacity','foundations']){const config=normalizeConsultationConfig({questions:[location]},programme);assert.equal(config.questions.filter(q=>q.id===HOME_EQUIPMENT_FIELD).length,1);}
 assert.equal(normalizeConsultationConfig(null,'boardroom').questions.some(q=>q.id===HOME_EQUIPMENT_FIELD),false);
});
test('hidden conditional question is not required; shown configured requirement is enforced',()=>{
 const config={questions:[{...withHomeEquipmentQuestion([location])[1],required:true}]};
 assert.equal(validateConsultationAnswers(config,{equipment_access:'Full Gym'}),null);
 assert.match(validateConsultationAnswers(config,{equipment_access:'Home Gym'})||'',/required/);
 assert.equal(validateConsultationAnswers(config,{equipment_access:'Home Gym',home_equipment_details:'No equipment'}),null);
});
test('older and hidden submissions retain inventory; explicit edits and clearing remain possible',()=>{
 const previous={home_equipment_details:'Dumbbells 2 × 5kg'};
 assert.equal(savedHomeEquipmentDetails({equipment_access:'Full Gym'},previous),previous.home_equipment_details);
 assert.equal(savedHomeEquipmentDetails({home_equipment_details:'  2 × 10kg  '},previous),'2 × 10kg');
 assert.equal(savedHomeEquipmentDetails({home_equipment_details:''},previous),'');
});
test('training context preserves exact quantities and excludes retained inventory when home is no longer selected',()=>{
 const details='Dumbbells 2 × 5kg, 2 × 10kg; bench; heavy band';assert.match(homeEquipmentTrainingContext({equipment_access:'Home Gym',home_equipment_details:details}),/2 × 5kg, 2 × 10kg; bench; heavy band/);
 assert.equal(homeEquipmentTrainingContext({equipment_access:'Full Gym',home_equipment_details:details}),'');
 assert.match(homeEquipmentTrainingContext({equipment_access:'Home Gym'}),/not been provided/);
});
