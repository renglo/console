import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables using Vite's loadEnv
const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, __dirname, "");

// VITE_EXTENSIONS is canonical; VITE_BOOTSTRAP_PLUGINS kept for compatibility.
const bootstrapExtensions =
  env.VITE_EXTENSIONS ||
  env.VITE_BOOTSTRAP_PLUGINS ||
  "data,schd,knowledge";

const extensions = bootstrapExtensions
  .split(",")
  .map((ext) => ext.trim())
  .filter(Boolean);

/**
 * Resolve where an extension's UI entrypoints live for this console checkout.
 *
 * Three renders, one precedence rule:
 *   1. monorepo dev (dev.bat) — git clone at ../extensions/<handle>/ui wins
 *   2. renglo-ci compose — npm pin in node_modules/@renglo/<handle>
 *   3. arbitium-bom deploy_console — same npm path from CodeArtifact
 *
 * Do not add a blanket "@extensions" -> "../extensions" alias: in compose/CI the
 * extensions/ tree is partial (e.g. pes only) and router imports like
 * @extensions/<handle>/ui/<handle>.tsx would miss npm packages.
 */
export function resolveExtensionUiRoot(
  handle: string,
  consoleDir: string = __dirname,
): string | undefined {
  const localUi = path.resolve(consoleDir, `../extensions/${handle}/ui`);
  if (fs.existsSync(localUi)) {
    return localUi;
  }

  const npmRoot = path.resolve(consoleDir, `node_modules/@renglo/${handle}`);
  if (fs.existsSync(npmRoot)) {
    return npmRoot;
  }

  return undefined;
}

const dynamicAliases: Record<string, string> = {};
for (const extension of extensions) {
  const uiRoot = resolveExtensionUiRoot(extension);
  if (!uiRoot) {
    continue;
  }

  // Router/nav/onboarding: @extensions/<handle>/ui/<handle>.tsx
  dynamicAliases[`@extensions/${extension}/ui`] = uiRoot;
  // Direct package imports: @renglo/data/ui/components/...
  dynamicAliases[`@renglo/${extension}/ui`] = uiRoot;
  dynamicAliases[`@renglo/${extension}`] = uiRoot;
}

export const extensionAliases = dynamicAliases;
