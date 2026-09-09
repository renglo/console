/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DEV_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:renglo-extension-ui" {
  export type ExtensionUiKind = "onboarding" | "sidenav" | "sheetnav" | "tool";
  export function listExtensionHandles(kind: ExtensionUiKind): string[];
  export function loadExtensionUi(
    kind: ExtensionUiKind,
    name: string,
  ): Promise<{ default: import("react").ComponentType<any> }>;
}

