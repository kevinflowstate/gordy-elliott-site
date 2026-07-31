import { spawnSync } from "node:child_process";
import appIdentity from "../config/app-identity.json" with { type: "json" };

const env = {
  ...process.env,
  CAPACITOR_SERVER_URL: process.env.CAPACITOR_SERVER_URL || appIdentity.productionUrl,
};

for (const [command, args] of [
  ["npm", ["run", "ios:prepare"]],
  ["cap", ["sync", "ios"]],
]) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
