import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {revokeExternalProviderAccess} from '@/lib/account-provider-revocation';
test('admin deletion revokes external access before deleting the verified user, and logs failures',()=>{
 const source=fs.readFileSync('app/api/admin/clients/[id]/route.ts','utf8');
 assert.ok(source.indexOf('await revokeExternalProviderAccess')<source.indexOf('admin.auth.admin.deleteUser'));
 assert.match(source,/client_calendar_connections/);assert.match(source,/Client deletion provider revocation failed/);
});
test('revocation passes real client Terra IDs once and skips mocks',async()=>{
 const calls:string[]=[];
 await revokeExternalProviderAccess([{terra_user_id:'real',raw_user:{}},{terra_user_id:'real',raw_user:{}},{terra_user_id:'mock',raw_user:{mock:true}}],[],{deauthenticateTerraUser:async id=>{calls.push(id)},deleteComposioConnectedAccount:async()=>{},listComposioConnectedAccountIds:async()=>[]});
 assert.deepEqual(calls,['real']);
});
