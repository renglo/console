import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

/** @renglo/<extension>/<path-within-ui> (legacy host-scope imports) */
const RENGLO_SUBPATH = /^@renglo\/([^/]+)\/(.+)$/;
/** @extensions/<extension>/ui/<path-within-ui> */
const EXTENSIONS_UI_SUBPATH = /^@extensions\/([^/]+)\/ui\/(.+)$/;
/** @publisher/<handle>/<path-within-ui> for any scoped extension package */
const SCOPED_PACKAGE_SUBPATH = /^@([^/]+)\/([^/]+)\/(.+)$/;

export const VIRTUAL_EXTENSION_UI_ID = "virtual:renglo-extension-ui";
const RESOLVED_VIRTUAL_EXTENSION_UI_ID = `\0${VIRTUAL_EXTENSION_UI_ID}`;

export const EXTENSION_UI_KINDS = ["onboarding", "sidenav", "sheetnav", "tool"] as const;
export type ExtensionUiKind = (typeof EXTENSION_UI_KINDS)[number];

const KIND_SUBPATH: Record<ExtensionUiKind, (name: string) => string> = {
  onboarding: (name) => `onboarding/${name}_onboarding.tsx`,
  sidenav: (name) => `navigation/${name}_sidenav.tsx`,
  sheetnav: (name) => `navigation/${name}_sheetnav.tsx`,
  tool: (name) => `${name}.tsx`,
};

export type ExtensionUiCatalog = Record<ExtensionUiKind, Record<string, string>>;

function posixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

/** Relative specifier so Vite/Rollup treat the file as a module, not a site URL. */
export function viteImportSpecifier(filePath: string, fromDir: string = __dirname): string {
  const rel = posixPath(path.relative(fromDir, filePath));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function readPackageJson(dir: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(path.join(dir, "package.json"), "utf8");
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // missing or invalid
  }
  return null;
}

export function isWlPackageName(name: string): boolean {
  return /^@[^/]+\/wl$/.test(name);
}

export function handleFromPackageName(packageName: string, folder: string): string {
  if (packageName.startsWith("@") && packageName.includes("/")) {
    return packageName.split("/")[1] ?? folder;
  }
  return packageName || folder;
}

function handleFromMain(pkg: Record<string, unknown> | null): string | null {
  const main = typeof pkg?.main === "string" ? pkg.main.trim() : "";
  if (!main) {
    return null;
  }
  const base = posixPath(main).split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  if (!base || base === "index") {
    return null;
  }
  return base;
}

function scanUiHandles(uiRoot: string): string[] {
  const handles: string[] = [];
  const navDir = path.join(uiRoot, "navigation");
  if (fs.existsSync(navDir)) {
    for (const file of listFileNames(navDir)) {
      const match = file.match(/^(.+)_sidenav\.[^.]+$/);
      if (match?.[1]) {
        handles.push(match[1]);
      }
    }
  }
  const onboardingDir = path.join(uiRoot, "onboarding");
  if (fs.existsSync(onboardingDir)) {
    for (const file of listFileNames(onboardingDir)) {
      const match = file.match(/^(.+)_onboarding\.[^.]+$/);
      if (match?.[1]) {
        handles.push(match[1]);
      }
    }
  }
  return handles;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function resolveExistingFile(basePath: string): string | null {
  for (const suffix of SOURCE_EXTENSIONS) {
    const candidate = `${basePath}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function hasUiShape(uiRoot: string, handle: string): boolean {
  return EXTENSION_UI_KINDS.some((kind) =>
    resolveExistingFile(path.join(uiRoot, KIND_SUBPATH[kind](handle))),
  );
}

/**
 * UI handle for an extension root.
 *
 * npm names like @arbitium/lab do not always match the files or the API
 * handle (arbitium.tsx / handle "arbitium"). Prefer package.json "main",
 * then names that actually have onboarding/sidenav/tool files.
 */
export function resolveExtensionHandle(
  uiRoot: string,
  packageName: string,
  folder: string,
): string | null {
  if (!fs.existsSync(uiRoot)) {
    return null;
  }
  const pkg = readPackageJson(uiRoot);
  const name = typeof pkg?.name === "string" ? pkg.name : packageName;
  if (name === "@renglo/console" || isWlPackageName(name)) {
    return null;
  }
  const candidates = uniqueStrings([
    handleFromMain(pkg),
    handleFromPackageName(name, folder),
    folder,
    ...scanUiHandles(uiRoot),
  ]);
  return candidates.find((handle) => hasUiShape(uiRoot, handle)) ?? null;
}

export function isExtensionUiRoot(uiRoot: string, handle: string): boolean {
  if (!fs.existsSync(uiRoot)) {
    return false;
  }
  const pkg = readPackageJson(uiRoot);
  const packageName = typeof pkg?.name === "string" ? pkg.name : handle;
  if (packageName === "@renglo/console" || isWlPackageName(packageName)) {
    return false;
  }
  return hasUiShape(uiRoot, handle);
}

function listDirNames(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name);
}

function listFileNames(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function addRoot(roots: Map<string, string[]>, handle: string, uiRoot: string): void {
  const normalized = posixPath(path.resolve(uiRoot));
  const existing = roots.get(handle) ?? [];
  if (!existing.includes(normalized)) {
    existing.push(normalized);
    roots.set(handle, existing);
  }
}

/** handle → UI roots, git checkout first, then npm packages of any scope. */
export function discoverExtensionUiRoots(
  extensionsRoot: string,
  nodeModulesRoot: string,
): Map<string, string[]> {
  const roots = new Map<string, string[]>();

  for (const folder of listDirNames(extensionsRoot)) {
    const uiRoot = path.join(extensionsRoot, folder, "ui");
    const pkg = readPackageJson(uiRoot);
    const packageName = typeof pkg?.name === "string" ? pkg.name : folder;
    const handle = resolveExtensionHandle(uiRoot, packageName, folder);
    if (handle) {
      addRoot(roots, handle, uiRoot);
    }
  }

  for (const scope of listDirNames(nodeModulesRoot)) {
    if (!scope.startsWith("@") || scope === "@types") {
      continue;
    }
    const scopeDir = path.join(nodeModulesRoot, scope);
    for (const pkgName of listDirNames(scopeDir)) {
      const uiRoot = path.join(scopeDir, pkgName);
      const pkg = readPackageJson(uiRoot);
      const packageName = typeof pkg?.name === "string" ? pkg.name : `${scope}/${pkgName}`;
      const handle = resolveExtensionHandle(uiRoot, packageName, pkgName);
      if (handle) {
        addRoot(roots, handle, uiRoot);
      }
    }
  }

  return roots;
}

export function listExtensionNames(extensionsRoot: string, nodeModulesRoot: string): string[] {
  return [...discoverExtensionUiRoots(extensionsRoot, nodeModulesRoot).keys()].sort();
}

function resolveFromRoots(roots: string[], subpath: string): string | null {
  for (const uiRoot of roots) {
    const resolved = resolveExistingFile(path.join(uiRoot, subpath));
    if (resolved) {
      return resolved;
    }
  }
  return null;
}

export function resolveExtensionUiFile(
  extensionsRoot: string,
  nodeModulesRoot: string,
  extension: string,
  subpath: string,
  roots?: Map<string, string[]>,
): string | null {
  const discovered = roots ?? discoverExtensionUiRoots(extensionsRoot, nodeModulesRoot);
  const fromCatalog = resolveFromRoots(discovered.get(extension) ?? [], subpath);
  if (fromCatalog) {
    return fromCatalog;
  }

  const fallback = [
    path.join(extensionsRoot, extension, "ui", subpath),
    path.join(nodeModulesRoot, "@renglo", extension, subpath),
  ];
  for (const basePath of fallback) {
    const resolved = resolveExistingFile(basePath);
    if (resolved) {
      return resolved;
    }
  }
  return null;
}

export function buildExtensionUiCatalog(
  extensionsRoot: string,
  nodeModulesRoot: string,
): ExtensionUiCatalog {
  const catalog: ExtensionUiCatalog = {
    onboarding: {},
    sidenav: {},
    sheetnav: {},
    tool: {},
  };
  const roots = discoverExtensionUiRoots(extensionsRoot, nodeModulesRoot);

  for (const name of [...roots.keys()].sort()) {
    for (const kind of EXTENSION_UI_KINDS) {
      const resolved = resolveExtensionUiFile(
        extensionsRoot,
        nodeModulesRoot,
        name,
        KIND_SUBPATH[kind](name),
        roots,
      );
      if (resolved) {
        catalog[kind][name] = posixPath(resolved);
      }
    }
  }

  return catalog;
}

function renderExtensionUiModule(catalog: ExtensionUiCatalog): string {
  const loaders = EXTENSION_UI_KINDS.map((kind) => {
    const entries = Object.entries(catalog[kind])
      .map(
        ([name, filePath]) =>
          `    ${JSON.stringify(name)}: () => import(${JSON.stringify(viteImportSpecifier(filePath))})`,
      )
      .join(",\n");
    return `  ${kind}: {\n${entries}\n  }`;
  }).join(",\n");

  return `const loaders = {
${loaders}
};

export function listExtensionHandles(kind) {
  return Object.keys(loaders[kind] || {});
}

export function loadExtensionUi(kind, name) {
  const loader = loaders[kind]?.[name];
  if (!loader) {
    return Promise.reject(new Error("Extension UI not found: " + kind + "/" + name));
  }
  return loader();
}
`;
}

function isExtensionImporter(
  importer: string | undefined,
  nodeModulesRoot: string,
): boolean {
  if (!importer) {
    return false;
  }
  const normalized = posixPath(importer);
  if (normalized.includes("/extensions/")) {
    return true;
  }
  const match = normalized.match(/\/node_modules\/(@[^/]+\/[^/]+)\//);
  if (!match) {
    return false;
  }
  const pkgDir = path.join(nodeModulesRoot, ...match[1].split("/"));
  const handle = match[1].split("/")[1];
  return resolveExtensionHandle(pkgDir, match[1], handle) !== null;
}

/**
 * Resolve cross-extension UI imports:
 *   @renglo/data/pages/tool_data_crud
 *   @publisher/handle/pages/board
 *   @extensions/data/ui/pages/chat_inspect
 *
 * A package is an extension when it has the host UI shape
 * (onboarding/sidenav/sheetnav/tool). Console and scoped wl packs
 * (@scope/wl) are never extensions.
 *
 * Also emits virtual:renglo-extension-ui so production builds can statically
 * import those host entry files.
 */
export function rengloExtensionResolver(): Plugin {
  const extensionsRoot = path.resolve(__dirname, "../extensions");
  const nodeModulesRoot = path.resolve(__dirname, "node_modules");
  // Bare imports from extension files must be re-resolved as if they came from
  // console/ so Vite applies aliases, dedupe, and prebundled ESM deps.
  // require.resolve() would pin CJS mains (react/index.js, lucide-react CJS)
  // and named exports like Suspense / Ghost fail in the browser.
  const hostImporter = path.join(__dirname, "package.json");

  return {
    name: "renglo-extension-resolver",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source === VIRTUAL_EXTENSION_UI_ID) {
        return RESOLVED_VIRTUAL_EXTENSION_UI_ID;
      }

      const extensionsMatch = source.match(EXTENSIONS_UI_SUBPATH);
      if (extensionsMatch) {
        const [, extension, subpath] = extensionsMatch;
        return resolveExtensionUiFile(extensionsRoot, nodeModulesRoot, extension, subpath);
      }

      const rengloMatch = source.match(RENGLO_SUBPATH);
      if (rengloMatch) {
        const [, extension, subpath] = rengloMatch;
        return resolveExtensionUiFile(extensionsRoot, nodeModulesRoot, extension, subpath);
      }

      const scopedMatch = source.match(SCOPED_PACKAGE_SUBPATH);
      if (scopedMatch && scopedMatch[1] !== "extensions") {
        const [, scope, pkgHandle, subpath] = scopedMatch;
        const pkgDir = path.join(nodeModulesRoot, `@${scope}`, pkgHandle);
        const resolvedHandle =
          resolveExtensionHandle(pkgDir, `@${scope}/${pkgHandle}`, pkgHandle) ||
          resolveExtensionHandle(
            path.join(extensionsRoot, pkgHandle, "ui"),
            `@${scope}/${pkgHandle}`,
            pkgHandle,
          );
        if (resolvedHandle) {
          return resolveExtensionUiFile(extensionsRoot, nodeModulesRoot, resolvedHandle, subpath);
        }
      }

      if (
        isExtensionImporter(importer, nodeModulesRoot) &&
        source &&
        !source.startsWith("\0") &&
        !source.startsWith(".") &&
        !source.startsWith("/") &&
        !source.startsWith("@/") &&
        !source.startsWith("@extensions/") &&
        !source.includes(":")
      ) {
        const resolved = await this.resolve(source, hostImporter, {
          skipSelf: true,
        });
        return resolved;
      }

      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_EXTENSION_UI_ID) {
        return null;
      }
      const catalog = buildExtensionUiCatalog(extensionsRoot, nodeModulesRoot);
      const onboarded = Object.keys(catalog.onboarding);
      console.log(
        `[renglo-extension-ui] onboarding=${onboarded.join(",") || "(none)"} ` +
          `sidenav=${Object.keys(catalog.sidenav).join(",") || "(none)"} ` +
          `tool=${Object.keys(catalog.tool).join(",") || "(none)"}`,
      );
      return renderExtensionUiModule(catalog);
    },
  };
}
