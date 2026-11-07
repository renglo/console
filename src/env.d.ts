/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DEV_MODE: string
  readonly VITE_CLOUD: string
  readonly VITE_COGNITO_REGION: string
  readonly VITE_COGNITO_USERPOOL_ID: string
  readonly VITE_COGNITO_APP_CLIENT_ID: string
  readonly VITE_COGNITO_DOMAIN: string
  readonly VITE_ENTRA_TENANT_ID: string
  readonly VITE_ENTRA_CLIENT_ID: string
  /** Optional. When unset, derived from OpenID metadata using VITE_ENTRA_TENANT_ID. */
  readonly VITE_ENTRA_AUTHORITY?: string
  /** Optional. Defaults to api://{VITE_ENTRA_CLIENT_ID}/access_as_user when unset. */
  readonly VITE_ENTRA_API_SCOPE?: string
  /** Optional. Entra identity provider object id for Google (direct `idp=` hint). */
  readonly VITE_ENTRA_IDP_GOOGLE?: string
  /** Required for Continue with Okta on Azure: Entra IdP object id for your Okta federation. */
  readonly VITE_ENTRA_IDP_OKTA?: string
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
  /** URL for extensions/<handle>/ui/icon.svg. Empty when the file is absent. */
  export function extensionIconUrl(name: string): string;
}

