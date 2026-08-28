import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

/** @renglo/<extension>/<path-within-ui> */
const RENGLO_SUBPATH = /^@renglo\/([^/]+)\/(.+)$/;
/** @extensions/<extension>/ui/<path-within-ui> */
const EXTENSIONS_UI_SUBPATH = /^@extensions\/([^/]+)\/ui\/(.+)$/;

function resolveExistingFile(basePath: string): string | null {
  for (const suffix of SOURCE_EXTENSIONS) {
    const candidate = `${basePath}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function resolveExtensionUiFile(
  extensionsRoot: string,
  nodeModulesRoot: string,
  extension: string,
  subpath: string,
): string | null {
  const candidates = [
    path.join(extensionsRoot, extension, "ui", subpath),
    path.join(nodeModulesRoot, "@renglo", extension, subpath),
  ];

  for (const basePath of candidates) {
    const resolved = resolveExistingFile(basePath);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

/**
 * Resolve cross-extension UI imports for both conventions:
 *   @renglo/data/pages/tool_data_crud
 *   @extensions/data/ui/pages/chat_inspect
 *
 * Local git checkouts win when present; npm-pinned extensions fall back to
 * node_modules/@renglo/<name>/ with the same ui-relative layout.
 */
export function rengloExtensionResolver(): Plugin {
  const extensionsRoot = path.resolve(__dirname, "../extensions");
  const nodeModulesRoot = path.resolve(__dirname, "node_modules");

  return {
    name: "renglo-extension-resolver",
    enforce: "pre",
    resolveId(source) {
      const rengloMatch = source.match(RENGLO_SUBPATH);
      if (rengloMatch) {
        const [, extension, subpath] = rengloMatch;
        return resolveExtensionUiFile(extensionsRoot, nodeModulesRoot, extension, subpath);
      }

      const extensionsMatch = source.match(EXTENSIONS_UI_SUBPATH);
      if (extensionsMatch) {
        const [, extension, subpath] = extensionsMatch;
        return resolveExtensionUiFile(extensionsRoot, nodeModulesRoot, extension, subpath);
      }

      return null;
    },
  };
}
