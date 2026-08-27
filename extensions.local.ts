import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables using Vite's loadEnv
// Try development mode first, fallback to production
const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, __dirname, "");

// Get bootstrap extensions from environment (VITE_EXTENSIONS is canonical; VITE_BOOTSTRAP_PLUGINS kept for compatibility)
const bootstrapExtensions =
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
// Map both @renglo/<name> and @renglo/<name>/ui so package-style
// imports (@renglo/data/ui/components/...) resolve under local ui/.
const dynamicAliases: Record<string, string> = {};
for (const extension of extensions) {
  const localUi = path.resolve(__dirname, `../extensions/${extension}/ui`);
  if (fs.existsSync(localUi)) {
    dynamicAliases[`@renglo/${extension}/ui`] = localUi;
    dynamicAliases[`@renglo/${extension}`] = localUi;
  }
}

const localExtensionsRoot = path.resolve(__dirname, "../extensions");

export const extensionAliases = {
  ...dynamicAliases,
  ...(fs.existsSync(localExtensionsRoot)
    ? { "@extensions": localExtensionsRoot }
    : {}),
};