import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateTerraSdkToken } from "@/lib/terra/client";
import { normaliseTerraProvider, getTerraWidgetProvider } from "@/lib/terra/events";
test("SDK token proxy returns only token and public dev ID", async()=>{
 const saved=[process.env.TERRA_DEV_ID,process.env.TERRA_API_KEY];
 process.env.TERRA_DEV_ID="public-dev";process.env.TERRA_API_KEY="private-key";
 try {
  const result=await generateTerraSdkToken(async(url,init)=>{
   assert.equal(String(url),"https://api.tryterra.co/v2/auth/generateAuthToken");
   assert.equal((init?.headers as Record<string,string>)["x-api-key"],"private-key");
   return new Response(JSON.stringify({status:"success",token:"one-use",api_key:"private-key"}));
  });
  assert.deepEqual(result,{token:"one-use",devId:"public-dev"});
  assert.ok(!JSON.stringify(result).includes("private-key"));
  await assert.rejects(generateTerraSdkToken(async()=>new Response(JSON.stringify({status:"error",token:"ignored"}))));
 } finally {
  for(const [i,k] of ["TERRA_DEV_ID","TERRA_API_KEY"].entries()) {if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i]}
 }
});
test("native provider mapping and widget exclusion",()=>{
 assert.equal(normaliseTerraProvider("APPLE"),"apple");
 assert.equal(normaliseTerraProvider("HEALTH_CONNECT"),"healthconnect");
 for(const p of ["apple","healthconnect"] as const)assert.throws(()=>getTerraWidgetProvider(p),/native/);
});
test("SDK route enforces authenticated identity, consent and pending attempt",()=>{
 const s=fs.readFileSync("app/api/portal/integrations/terra/sdk-token/route.ts","utf8");
 assert.match(s,/auth.getUser/);assert.match(s,/body.consent !== true/);assert.match(s,/status:"pending"/);assert.match(s,/getTerraReferenceId\(profile.id\)/);assert.match(s,/Cache-Control/);
 const bridge=fs.readFileSync("lib/native/terra-health.ts","utf8");
 assert.match(bridge,/isNativePlatform/);assert.match(bridge,/isPluginAvailable\("TerraHealth"\)/);
});
