import assert from "node:assert/strict";
import test from "node:test";
import { pushFeedback } from "../lib/push-feedback";

test("a browser absence cannot imply a native failure after native acceptance", () => {
  const text = pushFeedback({ sent: 1, failed: 0, channels: { native: {sent:1,failed:0,subscriptionCount:1}, web:{sent:0,failed:0,subscriptionCount:0,reason:"Skipped because native push was delivered."} } });
  assert.match(text, /Native app: provider accepted 1/); assert.doesNotMatch(text,/Browser|delivered/);
});
test("native provider errors and absent browser registrations stay separate", () => {
  const text = pushFeedback({ sent:0,failed:1,channels:{native:{sent:0,failed:1,subscriptionCount:1,reason:"ExpiredProviderToken"},web:{sent:0,failed:0,subscriptionCount:0}} });
  assert.match(text,/Native app: 1 failed \(ExpiredProviderToken\)/); assert.match(text,/Browser: no registered device/);
});
test("registered devices without configured server remain different from no subscription", () => {
  assert.match(pushFeedback({channels:{native:{sent:0,failed:0,subscriptionCount:2,reason:"APNs credentials missing"},web:{sent:0,failed:0,subscriptionCount:0}}}),/2 registered; none accepted/);
});
test("suppression and missing result never assert physical receipt", () => {
  assert.equal(pushFeedback({suppressed:true}),"notifications paused for this client");
  assert.match(pushFeedback(),/unavailable/); assert.match(pushFeedback({sent:2}),/provider accepted 2/);
});
