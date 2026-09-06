import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const fallback = fileURLToPath(new URL("./src/lib/wl-fallback.ts", import.meta.url));

const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, __dirname, "");

// Same idea as VITE_EXTENSIONS: name the pack, pick up the local tree.
// @acme/wl → ../dev/acme-wl (workspace) or ../acme-wl (BOM checkout).
const requested =
  process.env.VITE_WL_PACKAGE?.trim() ||
  env.VITE_WL_PACKAGE?.trim() ||
  "";

function isWlPackageName(name: string): boolean {
  return /^@[^/]+\/wl$/.test(name) || /^[^@/]+-wl$/.test(name);
}

function folderFromSpec(spec: string): string {
  const scoped = spec.match(/^@([^/]+)\/wl$/);
  if (scoped) return `${scoped[1]}-wl`;
  return spec.replace(/^@/, "").replace(/\//g, "-");
}

function readPackageName(dir: string): string | null {
  try {
    const name = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name;
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

function isRequestedPack(dir: string): boolean {
  const name = readPackageName(dir);
  if (!name || !isWlPackageName(name)) return false;
  if (!requested) return true;
  return name === requested || folderFromSpec(name) === folderFromSpec(requested);
}

/** Local checkout wins, same as extensions.local.ts → ../extensions/<name>. */
function resolveLocalCheckout(spec: string): string | null {
  const folder = folderFromSpec(spec);
  for (const rel of [`../dev/${folder}`, `../${folder}`, `../ops/${folder}`]) {
    const dir = path.resolve(__dirname, rel);
    if (isRequestedPack(dir)) return dir;
  }
  return null;
}

function resolveInstalled(name: string): string | null {
  const parts = name.startsWith("@") ? name.split("/") : [name];
  const laidOut = path.join(__dirname, "node_modules", ...parts);
  if (isRequestedPack(laidOut)) return laidOut;
  try {
    const resolved = require.resolve(name);
    let dir = path.dirname(resolved);
    for (let i = 0; i < 6; i++) {
      if (isRequestedPack(dir)) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // not installed
  }
  return null;
}

function discoverInstalledWl(): string | null {
  const root = path.join(__dirname, "node_modules");
  if (!fs.existsSync(root)) return null;

  const found: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      const wlDir = path.join(root, entry.name, "wl");
      if (isRequestedPack(wlDir)) found.push(wlDir);
      continue;
    }
    if (entry.name.endsWith("-wl")) {
      const dir = path.join(root, entry.name);
      if (isRequestedPack(dir)) found.push(dir);
    }
  }
  return found.length === 1 ? found[0] : null;
}

function resolveWlPackageDir(): string | null {
  if (requested) {
    return resolveLocalCheckout(requested) || resolveInstalled(requested);
  }
  return discoverInstalledWl();
}

const wlDir = resolveWlPackageDir();

export const wlAliases: Record<string, string> = wlDir
  ? { "@wl": wlDir }
  : { "@wl": fallback };
