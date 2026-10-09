import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  extensionIconUrl,
  listExtensionHandles,
  loadExtensionUi,
  type ExtensionUiKind,
} from "virtual:renglo-extension-ui";

const Empty = () => null;

const cache = new Map<string, LazyExoticComponent<ComponentType<any>>>();

function unwrapDefault(mod: { default?: ComponentType<any> } | ComponentType<any>) {
  let current: any = mod;
  while (current && typeof current === "object" && "default" in current) {
    current = current.default;
  }
  return current;
}

/** Map a URL tool id or handle to the catalog handle. */
export function resolveToolHandle(
  portfolioTools: Record<string, { handle?: string } | undefined> | undefined,
  toolParam: string | undefined,
): string | undefined {
  const param = toolParam?.trim();
  if (!param || param === "undefined") {
    return undefined;
  }
  const byId = portfolioTools?.[param]?.handle?.trim();
  if (byId) {
    return byId;
  }
  const match = Object.values(portfolioTools || {}).find(
    (row) => row?.handle?.trim() === param,
  );
  return match?.handle?.trim();
}

/** Marketplace cards: every discovered onboarding UI. */
export function marketplaceHandles(): string[] {
  return listExtensionHandles("onboarding");
}

/** First matching ui/icon.svg among the given handles. Empty when none ship one. */
export function extensionIconSrc(...keys: Array<string | undefined>): string {
  for (const key of keys) {
    const trimmed = key?.trim();
    if (!trimmed || trimmed === "undefined") continue;
    const url = extensionIconUrl(trimmed);
    if (url) return url;
  }
  return "";
}

export function lazyExtensionUi(
  kind: ExtensionUiKind,
  name: string,
): ComponentType<any> {
  const handle = name?.trim();
  if (!handle || handle === "undefined") {
    return Empty;
  }

  const key = `${kind}:${handle}`;
  let component = cache.get(key);
  if (!component) {
    component = lazy(() =>
      loadExtensionUi(kind, handle)
        .then((mod) => {
          const rendered = unwrapDefault(mod);
          if (typeof rendered !== "function") {
            throw new Error(`Extension UI ${kind}/${handle} has no default export`);
          }
          return { default: rendered };
        })
        .catch((error) => {
          console.error(`${handle} : Extension UI not found (${kind})`, error);
          return { default: Empty };
        }),
    );
    cache.set(key, component);
  }
  return component;
}
