// Installs the signed APK on the running emulator/device and launches it.
// Usage: npm run emulator            (start an AVD first, e.g. `emulator -avd Medium_Phone_API_35`)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdk = process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const adb = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const { packageId } = JSON.parse(readFileSync(path.join(root, "twa-manifest.json"), "utf8"));

function adbRun(args) {
  const r = spawnSync(adb, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`adb ${args.join(" ")} failed`);
}

adbRun(["install", "-r", path.join(root, "app-release-signed.apk")]);
adbRun(["shell", "monkey", "-p", packageId, "-c", "android.intent.category.LAUNCHER", "1"]);
