// Builds and signs the LogBase TWA (Trusted Web Activity) with the local Android Studio JDK/SDK.
//
// Why not `bubblewrap build`? Bubblewrap only accepts an SDK laid out as `<sdk>/tools|bin` (the layout
// it downloads itself), not Android Studio's `cmdline-tools/latest/bin`. The Gradle project it generates
// builds fine against a normal SDK, so we drive Gradle + zipalign + apksigner + jarsigner directly.
//
// Outputs (gitignored): android/app-release-signed.apk (sideload / emulator) and
//                       android/app-release-bundle.aab (upload to Google Play)
//
// Usage: npm run build            (from android/)
// Signing password: env BUBBLEWRAP_KEYSTORE_PASSWORD, else the line in keystore-password.local.txt.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const bat = (name) => (isWin ? `${name}.bat` : name);

const sdk = process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const jdk = process.env.JAVA_HOME ?? "C:/Program Files/Android/Android Studio/jbr";
const env = { ...process.env, ANDROID_HOME: sdk, JAVA_HOME: jdk };

const twa = JSON.parse(readFileSync(path.join(root, "twa-manifest.json"), "utf8"));
const keystore = path.resolve(root, twa.signingKey.path);
const alias = twa.signingKey.alias;

function readPassword() {
  if (process.env.BUBBLEWRAP_KEYSTORE_PASSWORD) return process.env.BUBBLEWRAP_KEYSTORE_PASSWORD;
  const file = path.join(root, "keystore-password.local.txt");
  if (existsSync(file)) {
    const m = readFileSync(file, "utf8").match(/^keystore \+ key password \(same\): (.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error("Set BUBBLEWRAP_KEYSTORE_PASSWORD or create android/keystore-password.local.txt");
}

function run(cmd, args, opts = {}) {
  const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a}"` : a));
  const r = spawnSync(`"${cmd}"`, quoted, { cwd: root, env, stdio: "inherit", shell: true, ...opts });
  if (r.status !== 0) throw new Error(`Command failed (${r.status}): ${path.basename(cmd)} ${args[0] ?? ""}`);
}

// Newest installed build-tools (needs zipalign + apksigner).
const buildToolsDir = path.join(sdk, "build-tools");
const buildTools = readdirSync(buildToolsDir)
  .filter((v) => existsSync(path.join(buildToolsDir, v, bat("apksigner"))))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .pop();
if (!buildTools) throw new Error(`No Android build-tools with apksigner found in ${buildToolsDir}`);
const bt = path.join(buildToolsDir, buildTools);

if (!existsSync(keystore)) throw new Error(`Keystore not found: ${keystore}`);
const password = readPassword();

console.log(`\n▶ Gradle (assembleRelease + bundleRelease), build-tools ${buildTools}`);
run(path.join(root, bat("gradlew")), ["--no-daemon", "assembleRelease", "bundleRelease"]);

const unsigned = path.join(root, "app/build/outputs/apk/release/app-release-unsigned.apk");
const bundle = path.join(root, "app/build/outputs/bundle/release/app-release.aab");
const aligned = path.join(root, "app-release-aligned.apk");
const apkOut = path.join(root, "app-release-signed.apk");
const aabOut = path.join(root, "app-release-bundle.aab");

console.log("\n▶ zipalign + apksigner (APK)");
rmSync(aligned, { force: true });
run(path.join(bt, isWin ? "zipalign.exe" : "zipalign"), ["-p", "-f", "4", unsigned, aligned]);
run(path.join(bt, bat("apksigner")), [
  "sign", "--ks", keystore, "--ks-key-alias", alias,
  "--ks-pass", `pass:${password}`, "--key-pass", `pass:${password}`,
  "--out", apkOut, aligned,
]);
rmSync(aligned, { force: true });

console.log("\n▶ jarsigner (AAB)");
copyFileSync(bundle, aabOut);
run(path.join(jdk, "bin", isWin ? "jarsigner.exe" : "jarsigner"), [
  "-keystore", keystore, "-storepass", password, "-keypass", password,
  "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256", aabOut, alias,
]);

console.log(`\n✔ ${apkOut}\n✔ ${aabOut}\n`);
