import assert from 'node:assert/strict';
import test from 'node:test';
import { programmeShowsPortalPath } from '../lib/programmes';
test('Boardroom optional plans default off and do not unlock health prompts or AI',()=>{
 for(const path of ['/portal/exercise-plan','/portal/exercise-plan/session','/portal/nutrition-plan']) {
  assert.equal(programmeShowsPortalPath('boardroom',path),false);
  assert.equal(programmeShowsPortalPath('boardroom',path,true),true);
  assert.equal(programmeShowsPortalPath('capacity',path),true);
 }
 for(const path of ['/portal/ai','/portal/progress','/portal/cycle','/portal/daily-tracker']) assert.equal(programmeShowsPortalPath('boardroom',path,true),false);
 for(const path of ['/portal/training','/portal/inbox','/portal/plan','/portal/business-progress']) assert.equal(programmeShowsPortalPath('boardroom',path),true);
});
