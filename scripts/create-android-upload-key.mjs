import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { androidEnvironment } from "./android-environment.mjs";

const env = androidEnvironment();
const directory = join(env.ANDROID_BUILD_ROOT || "/Volumes/CodexDev", "Projects", "AT-CAPACITY-Releases", "android", "signing");
const keystore = join(directory, "at-capacity-upload.p12");
const config = join(directory, "signing.json");
if (existsSync(keystore) || existsSync(config)) throw new Error("Upload signing already exists; never replace a release key.");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const password = randomBytes(32).toString("base64url");
const signing = {
  ANDROID_KEYSTORE_FILE: keystore,
  ANDROID_KEYSTORE_PASSWORD: password,
  ANDROID_KEY_PASSWORD: password,
  ANDROID_KEY_ALIAS: "at-capacity-upload",
};
// Persist before keytool so an interruption cannot orphan the key.
writeFileSync(config, JSON.stringify(signing, null, 2), { mode: 0o600 });
const result = spawnSync(join(env.JAVA_HOME, "bin", "keytool"), [
  "-genkeypair", "-storetype", "PKCS12", "-keystore", keystore,
  "-storepass:env", "ANDROID_KEYSTORE_PASSWORD", "-keypass:env", "ANDROID_KEY_PASSWORD",
  "-alias", signing.ANDROID_KEY_ALIAS, "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000",
  "-dname", "CN=AT CAPACITY Upload", "-noprompt",
], { env: { ...env, ...signing }, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
chmodSync(keystore, 0o600);
const exported = spawnSync(join(env.JAVA_HOME, "bin", "keytool"), [
  "-exportcert", "-rfc", "-keystore", keystore, "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
  "-alias", signing.ANDROID_KEY_ALIAS, "-file", join(directory, "upload-certificate.pem"),
], { env: { ...env, ...signing }, stdio: "inherit" });
if (exported.status !== 0) process.exit(exported.status || 1);
console.log(`Private signing saved outside Git: ${directory}. Back up securely before release.`);
