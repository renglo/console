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

// Dynamically generate extension aliases
const dynamicAliases: Record<string, string> = {};
for (const extension of extensions) {
  dynamicAliases[`@renglo/${extension}`] = path.resolve(
    __dirname,
    `../extensions/${extension}/ui`
  );
}

export const extensionAliases = {
  ...dynamicAliases,
  // General alias for dynamic imports
  "@extensions": path.resolve(__dirname, "../extensions"),
};