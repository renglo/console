import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

/** @renglo/<extension>/<path-within-ui> — shared by cloned extensions and npm packages. */
const RENGLO_SUBPATH = /^@renglo\/([^/]+)\/(.+)$/;

function resolveExistingFile(basePath: string): string | null {
  for (const suffix of SOURCE_EXTENSIONS) {
    const candidate = `${basePath}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve cross-extension imports such as `@renglo/data/pages/tool_data_crud`.
 *
 * Local checkouts are aliased to `extensions/<name>/ui` (see extensions.local.ts).
 * Published packages live under `node_modules/@renglo/<name>/` with the same layout.
 * npm export maps on older pins may omit `./pages/*`; this plugin keeps both paths working.
 */
export function rengloExtensionResolver(): Plugin {
  const extensionsRoot = path.resolve(__dirname, "../extensions");
  const nodeModulesRoot = path.resolve(__dirname, "node_modules");

  return {
    name: "renglo-extension-resolver",
    enforce: "pre",
    resolveId(source) {
      const match = source.match(RENGLO_SUBPATH);
      if (!match) {
        return null;
      }

      const [, extension, subpath] = match;
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
    },
  };
}
