import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// loadEnv reads .env files; CI injects VITE_* via process.env (see deploy_console.yml).
const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, __dirname, "");

const viteDevMode =
  process.env.VITE_DEV_MODE === "true" ||
  env.VITE_DEV_MODE === "true";

// Get bootstrap extensions from environment (VITE_EXTENSIONS is canonical; VITE_BOOTSTRAP_PLUGINS kept for compatibility)
const bootstrapExtensions =
  process.env.VITE_EXTENSIONS ||
  env.VITE_EXTENSIONS ||
  env.VITE_BOOTSTRAP_PLUGINS ||
  "data,schd,knowledge"; // fallback default

// Parse the extensions list
const extensions = bootstrapExtensions
  .split(",")
  .map((ext) => ext.trim())
  .filter(Boolean);

// Local checkout wins when the tree exists (dev + hybrid CI).
// Production with npm pins leaves the specifier unresolved so Vite
// uses node_modules/@renglo/<name>.
const dynamicAliases: Record<string, string> = {};
for (const extension of extensions) {
  const localUi = path.resolve(__dirname, `../extensions/${extension}/ui`);
  if (fs.existsSync(localUi)) {
    dynamicAliases[`@renglo/${extension}`] = localUi;
  }
}

const localExtensionsRoot = path.resolve(__dirname, "../extensions");

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
