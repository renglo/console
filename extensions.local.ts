import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { resolveExtensionHandle } from "./renglo-extension-resolver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, __dirname, "");

const viteDevMode =
  process.env.VITE_DEV_MODE === "true" ||
  env.VITE_DEV_MODE === "true";

const localExtensionsRoot = path.resolve(__dirname, "../extensions");

function listDirNames(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name);
}

function readPackageName(uiRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(uiRoot, "package.json"), "utf8");
    const data = JSON.parse(raw) as { name?: unknown };
    if (typeof data?.name === "string") {
      return data.name;
    }
  } catch {
    // missing or invalid
  }
  return "";
}

/**
 * Local checkout wins when the tree exists (dev + hybrid CI).
 * Alias both the folder name (@renglo/arbitiumlab) and the UI handle
 * (@renglo/arbitium). Production with npm pins leaves unknown specifiers
 * unresolved so Vite uses node_modules.
 */
const dynamicAliases: Record<string, string> = {};
if (fs.existsSync(localExtensionsRoot)) {
  for (const folder of listDirNames(localExtensionsRoot)) {
    const uiRoot = path.join(localExtensionsRoot, folder, "ui");
    if (!fs.existsSync(uiRoot)) {
      continue;
    }
    const packageName = readPackageName(uiRoot) || folder;
    const handle = resolveExtensionHandle(uiRoot, packageName, folder);
    dynamicAliases[`@renglo/${folder}`] = uiRoot;
    if (handle && handle !== folder) {
      dynamicAliases[`@renglo/${handle}`] = uiRoot;
    }
  }
}

export const extensionAliases = {
  ...dynamicAliases,
  // Do not map @extensions -> ../extensions in production/CI builds.
  // That alias sends @extensions/data/ui/... to extensions/data/... even when
  // data is npm-pinned and never cloned. renglo-extension-resolver.ts handles
  // @extensions/<ext>/ui/... (git checkout or node_modules/@renglo/<ext>).
  ...(fs.existsSync(localExtensionsRoot) && viteDevMode
    ? { "@extensions": localExtensionsRoot }
    : {}),
};
