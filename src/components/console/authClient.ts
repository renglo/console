/**
 * The only place the console chooses Cognito or Entra.
 * Screens call these functions and do not read VITE_CLOUD.
 */

import type { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';

import { authCloud } from './authCloud';
import * as entra from './authEntra';
import {
  ACCOUNT_LINK_RETRY_KEY,
  AUTH_PROVIDER_STORAGE_KEY,
  beginFederatedSignIn,
  buildLogoutUrl,
  captureInvite,
  clearAuthSession,
  directoryProviderName,
  exchangeAuthorizationCode,
  maybeRetryLinkedAccount,
  NATIVE_PROVIDER,
  readOAuthReturn,
  signInErrorMessage,
  takePkceVerifier,
  providersForLogin,
  type AuthProvider,
} from './authFederation';
import referenceDocument from '@/auth/reference-providers.json';
import {
  completeNewPasswordChallenge,
  confirmPasswordReset,
  confirmSignUp,
  persistAuthenticationResult,
  requestPasswordReset,
  signIn as cognitoSignIn,
  signUp,
  type SignInResult,
} from './authService';

export type { AuthProvider, SignInResult };
export type RedirectSignIn = { kind: 'redirect' };
export type LoginSurface = {
  credentials: boolean;
  federated: boolean;
};

export type AuthCompletion =
  | { kind: 'session'; tokens: AuthenticationResultType }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

export {
  completeNewPasswordChallenge,
  confirmPasswordReset,
  confirmSignUp,
  persistAuthenticationResult,
  requestPasswordReset,
  signUp,
};

function azure(): boolean {
  return authCloud() === 'azure';
}

export function usesHostedDirectory(): boolean {
  return azure();
}

export function loginSurface(): LoginSurface {
  if (azure()) {
    return { credentials: false, federated: true };
  }
  return { credentials: true, federated: true };
}

/** Provider list for login/invite: on Azure, merge default Google/Okta rows when the API omits them. */
const referenceFederatedForEntra = (referenceDocument.providers as AuthProvider[]).filter(
  (p) => p.type !== 'native',
);

export function resolveLoginProviders(
  apiProviders: AuthProvider[] | null,
  devFallback: boolean,
  reference: AuthProvider[],
): AuthProvider[] {
  const base = providersForLogin(apiProviders, { devFallback, reference });
  if (!azure()) {
    return base;
  }
  const byId = new Map<string, AuthProvider>();
  for (const p of base) {
    byId.set(p.id, p);
  }
  for (const p of referenceFederatedForEntra) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }
  const merged = Array.from(byId.values()).sort(
    (left, right) => (left.display_order || 0) - (right.display_order || 0),
  );
  const oktaIdp = String(import.meta.env.VITE_ENTRA_IDP_OKTA || '').trim();
  return merged.filter((p) => {
    if (p.id !== 'okta') {
      return true;
    }
    if (oktaIdp) {
      return true;
    }
    return base.some((b) => b.id === 'okta' && b.enabled !== false);
  });
}

export async function signIn(username = '', password = ''): Promise<SignInResult | RedirectSignIn> {
  if (azure()) {
    return entra.signIn();
  }
  return cognitoSignIn(username, password);
}

function entraFederatedOptions(
  provider: AuthProvider,
  loginHint?: string,
): entra.EntraSignInOptions {
  const id = String(provider.id || '').trim().toLowerCase();
  const poolName = directoryProviderName(provider).toLowerCase();
  const googleIdp = String(import.meta.env.VITE_ENTRA_IDP_GOOGLE || '').trim();
  const oktaIdp = String(import.meta.env.VITE_ENTRA_IDP_OKTA || '').trim();
  const hint = (loginHint || '').trim();

  const isGoogle = id === 'google' || poolName === 'google';
  const isOkta = id === 'okta' || poolName === 'okta';

  if (isGoogle) {
    const opts: entra.EntraSignInOptions = {};
    if (googleIdp) {
      opts.idp = googleIdp;
    } else {
      opts.domainHint = 'google.com';
    }
    if (hint) {
      opts.loginHint = hint;
    }
    return opts;
  }
  if (isOkta) {
    if (!oktaIdp) {
      throw new Error(
        'Set VITE_ENTRA_IDP_OKTA to your Okta identity provider id from Microsoft Entra admin center (External Identities → identity providers).',
      );
    }
    return { idp: oktaIdp, ...(hint ? { loginHint: hint } : {}) };
  }
  throw new Error(
    `No Entra identity provider mapping for "${provider.display_name}". Supported built-ins: Google (optional VITE_ENTRA_IDP_GOOGLE, else domain_hint=google.com) and Okta (VITE_ENTRA_IDP_OKTA required).`,
  );
}

export async function startFederatedSignIn(
  provider: AuthProvider,
  search: string,
  loginHint?: string,
): Promise<void> {
  if (azure()) {
    captureInvite(search, sessionStorage);
    const options = entraFederatedOptions(provider, loginHint);
    await entra.signIn(options);
    return;
  }
  const domain = String(import.meta.env.VITE_COGNITO_DOMAIN || '').trim();
  const clientId = String(import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '').trim();
  if (!domain || !clientId) {
    throw new Error('Sign-in is not configured for this environment.');
  }
  const url = await beginFederatedSignIn({
    provider,
    search,
    storage: sessionStorage,
    domain,
    clientId,
    redirectUri: `${window.location.origin}/callback`,
    loginHint,
  });
  window.location.assign(url);
}

export async function completeRedirect(): Promise<AuthCompletion> {
  if (azure()) {
    try {
      const tokens = await entra.completeRedirect();
      if (!tokens?.AccessToken) {
        return { kind: 'error', message: 'Sign-in could not be verified.' };
      }
      return { kind: 'session', tokens };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      return { kind: 'error', message };
    }
  }
  return completeCognitoRedirect();
}

async function completeCognitoRedirect(): Promise<AuthCompletion> {
  const returned = readOAuthReturn({
    query: window.location.search,
    storage: sessionStorage,
  });
  const domain = String(import.meta.env.VITE_COGNITO_DOMAIN || '').trim();
  const clientId = String(import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '').trim();
  const redirectUri = `${window.location.origin}/callback`;
  if (!returned.ok) {
    if (!domain || !clientId) {
      return { kind: 'error', message: signInErrorMessage(returned.error) };
    }
    const retryUrl = await maybeRetryLinkedAccount({
      error: returned.error,
      storage: sessionStorage,
      search: window.location.search,
      domain,
      clientId,
      redirectUri,
    });
    if (retryUrl) {
      window.location.replace(retryUrl);
      return { kind: 'pending' };
    }
    return { kind: 'error', message: signInErrorMessage(returned.error) };
  }

  const verifier = takePkceVerifier(sessionStorage);
  if (!verifier || !domain || !clientId) {
    return { kind: 'error', message: 'Sign-in could not be verified.' };
  }
  try {
    const tokens = await exchangeAuthorizationCode({
      domain,
      clientId,
      redirectUri,
      code: returned.code,
      verifier,
    });
    sessionStorage.removeItem(ACCOUNT_LINK_RETRY_KEY);
    if (!tokens.AccessToken) {
      return { kind: 'error', message: 'Sign-in could not be verified.' };
    }
    return { kind: 'session', tokens };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed';
    return { kind: 'error', message: signInErrorMessage(message) };
  }
}

export function signOut(): 'away' | 'local' {
  if (azure()) {
    entra.signOut();
    return 'away';
  }
  const provider = sessionStorage.getItem(AUTH_PROVIDER_STORAGE_KEY);
  const domain = String(import.meta.env.VITE_COGNITO_DOMAIN || '').trim();
  const clientId = String(import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '').trim();
  clearAuthSession(sessionStorage);
  if (provider && provider !== NATIVE_PROVIDER && domain && clientId) {
    window.location.href = buildLogoutUrl({
      domain,
      clientId,
      logoutUri: `${window.location.origin}/login`,
    });
    return 'away';
  }
  return 'local';
}
