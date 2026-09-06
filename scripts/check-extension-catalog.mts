import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildExtensionUiCatalog,
  isExtensionUiRoot,
  isWlPackageName,
  listExtensionNames,
  resolveExtensionHandle,
  viteImportSpecifier,
} from "../renglo-extension-resolver.ts";

const consoleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionsRoot = path.resolve(consoleRoot, "../extensions");
const nodeModulesRoot = path.resolve(consoleRoot, "node_modules");

const names = listExtensionNames(extensionsRoot, nodeModulesRoot);
assert.ok(names.includes("data"), `expected data in ${names.join(",")}`);
assert.ok(names.includes("schd"), `expected schd in ${names.join(",")}`);
assert.ok(!names.includes("wl"), `wl must not be an extension: ${names.join(",")}`);
assert.ok(!names.includes("console"), `console must not be an extension: ${names.join(",")}`);

const catalog = buildExtensionUiCatalog(extensionsRoot, nodeModulesRoot);
assert.ok(catalog.onboarding.data?.endsWith("data_onboarding.tsx"), catalog.onboarding.data);
assert.ok(catalog.sidenav.data?.endsWith("data_sidenav.tsx"), catalog.sidenav.data);
assert.ok(catalog.tool.data?.endsWith("data.tsx"), catalog.tool.data);
assert.equal(
  viteImportSpecifier(catalog.tool.data, consoleRoot),
  "../extensions/data/ui/data.tsx",
);
assert.ok(catalog.onboarding.schd?.endsWith("schd_onboarding.tsx"), catalog.onboarding.schd);

assert.equal(isWlPackageName("@acme/wl"), true);
assert.equal(isWlPackageName("@acme/casting"), false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ext-catalog-"));
try {
  const extRoot = path.join(tmp, "extensions");
  const nmRoot = path.join(tmp, "node_modules");
  fs.mkdirSync(path.join(nmRoot, "@acme", "casting", "onboarding"), { recursive: true });
  fs.writeFileSync(
    path.join(nmRoot, "@acme", "casting", "package.json"),
    JSON.stringify({
      name: "@acme/casting",
    }),
  );
  fs.writeFileSync(
    path.join(nmRoot, "@acme", "casting", "onboarding", "casting_onboarding.tsx"),
    "export default function CastingOnboarding() { return null }\n",
  );

  fs.mkdirSync(path.join(nmRoot, "@vendor", "tools-lib"), { recursive: true });
  fs.writeFileSync(
    path.join(nmRoot, "@vendor", "tools-lib", "package.json"),
    JSON.stringify({ name: "@vendor/tools-lib" }),
  );

  fs.mkdirSync(path.join(nmRoot, "@acme", "wl"), { recursive: true });
  fs.writeFileSync(
    path.join(nmRoot, "@acme", "wl", "package.json"),
    JSON.stringify({ name: "@acme/wl" }),
  );

  fs.mkdirSync(path.join(nmRoot, "@renglo", "console"), { recursive: true });
  fs.writeFileSync(
    path.join(nmRoot, "@renglo", "console", "package.json"),
    JSON.stringify({ name: "@renglo/console" }),
  );

  fs.mkdirSync(path.join(extRoot, "shapeonly", "ui", "onboarding"), { recursive: true });
  fs.writeFileSync(
    path.join(extRoot, "shapeonly", "ui", "onboarding", "shapeonly_onboarding.tsx"),
    "export default function ShapeOnly() { return null }\n",
  );

  fs.mkdirSync(path.join(nmRoot, "@acme", "lab", "navigation"), { recursive: true });
  fs.writeFileSync(
    path.join(nmRoot, "@acme", "lab", "package.json"),
    JSON.stringify({ name: "@acme/lab", main: "./workbench.tsx" }),
  );
  fs.writeFileSync(
    path.join(nmRoot, "@acme", "lab", "workbench.tsx"),
    "export default function Workbench() { return null }\n",
  );
  fs.writeFileSync(
    path.join(nmRoot, "@acme", "lab", "navigation", "workbench_sidenav.tsx"),
    "export default function WorkbenchNav() { return null }\n",
  );

  assert.equal(isExtensionUiRoot(path.join(nmRoot, "@acme", "casting"), "casting"), true);
  assert.equal(
    resolveExtensionHandle(path.join(nmRoot, "@acme", "lab"), "@acme/lab", "lab"),
    "workbench",
  );
  assert.equal(isExtensionUiRoot(path.join(nmRoot, "@acme", "wl"), "wl"), false);
  assert.equal(isExtensionUiRoot(path.join(nmRoot, "@renglo", "console"), "console"), false);
  assert.equal(isExtensionUiRoot(path.join(nmRoot, "@vendor", "tools-lib"), "tools-lib"), false);

  const discovered = listExtensionNames(extRoot, nmRoot);
  assert.deepEqual(discovered, ["casting", "shapeonly", "workbench"]);
  const fakeCatalog = buildExtensionUiCatalog(extRoot, nmRoot);
  assert.ok(fakeCatalog.onboarding.casting?.endsWith("casting_onboarding.tsx"));
  assert.ok(fakeCatalog.onboarding.shapeonly?.endsWith("shapeonly_onboarding.tsx"));
  assert.ok(fakeCatalog.tool.workbench?.endsWith("workbench.tsx"));
  assert.ok(fakeCatalog.sidenav.workbench?.endsWith("workbench_sidenav.tsx"));
  assert.equal(fakeCatalog.sidenav.lab, undefined);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(
  `ok catalog names=${names.join(",")} onboardings=${Object.keys(catalog.onboarding).join(",")}`,
);
