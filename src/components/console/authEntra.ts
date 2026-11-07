/**
 * Entra ID authorization-code + PKCE client.
 *
 * This module does not read VITE_CLOUD. The session client calls it only
 * when the console is running against Azure.
 *
 * @azure/msal-browser is not imported: this workspace's npm registry does
 * not serve that package.
 */

import type { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';

import {
  captureInvite,
  clearAuthSession,
  decodeState,
  encodeState,
  pkceChallenge,
  randomUrlSafe,
} from './authFederation';
import { parseJwt, sessionUsername } from './authSession';

const ENTRA_VERIFIER_KEY = 'renglo_entra_verifier';
const ENTRA_OIDC_CACHE_KEY = 'renglo_entra_oidc';

type OidcDocument = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
};

function entraApiScope(): string {
  const configured = String(import.meta.env.VITE_ENTRA_API_SCOPE || '').trim();
  if (configured) {
    return configured;
  }
  const clientId = String(import.meta.env.VITE_ENTRA_CLIENT_ID || '').trim();
  return clientId ? `api://${clientId}/access_as_user` : '';
}

function entraScopes(): string[] {
  const scope = entraApiScope();
  const scopes = ['openid', 'profile', 'email'];
  if (scope) {
    scopes.push(scope);
  }
  return scopes;
}

async function fetchOidcDocument(tenantId: string): Promise<OidcDocument> {
  const primary = `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0/.well-known/openid-configuration`;
  const fallback = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;
  let response = await fetch(primary);
  if (!response.ok) {
    response = await fetch(fallback);
  }
  if (!response.ok) {
    throw new Error('Could not load Entra sign-in configuration for this tenant.');
  }
  return (await response.json()) as OidcDocument;
}

async function entraSignInBase(): Promise<string> {
  const configured = String(import.meta.env.VITE_ENTRA_AUTHORITY || '').trim().replace(/\/$/, '');
  if (configured) {
    if (configured.endsWith('/v2.0')) {
      return configured.slice(0, -'/v2.0'.length);
    }
    return configured;
  }
  const tenant = String(import.meta.env.VITE_ENTRA_TENANT_ID || '').trim();
  if (!tenant) {
    throw new Error('Entra sign-in is not configured for this environment.');
  }
  const cached = sessionStorage.getItem(ENTRA_OIDC_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { base: string };
      if (parsed.base) {
        return parsed.base;
      }
    } catch {
      sessionStorage.removeItem(ENTRA_OIDC_CACHE_KEY);
    }
  }
  const doc = await fetchOidcDocument(tenant);
  const authUrl = doc.authorization_endpoint || '';
  const match = authUrl.match(/^(.*)\/oauth2\/v2\.0\/authorize/);
  const base = (match ? match[1] : '').replace(/\/$/, '');
  if (!base) {
    throw new Error('Entra sign-in configuration did not include an authorize URL.');
  }
  sessionStorage.setItem(
    ENTRA_OIDC_CACHE_KEY,
    JSON.stringify({
      base,
      token_endpoint: doc.token_endpoint,
      end_session_endpoint: doc.end_session_endpoint || '',
    }),
  );
  return base;
}

function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

function bearerToken(idToken: string, accessToken: string): string {
  if (!accessToken) {
    return idToken;
  }
  if (!idToken) {
    return accessToken;
  }
  const idName = sessionUsername(parseJwt(idToken));
  const accessName = sessionUsername(parseJwt(accessToken));
  if (idName && accessName && idName !== accessName) {
    return idToken;
  }
  return accessToken;
}

/** Optional hints for Entra External ID federated sign-in (same authorize URL + PKCE). */
export type EntraSignInOptions = {
  /** Identity provider key from Entra admin center (often a UUID for OIDC/SAML IdPs). */
  idp?: string;
  /**
   * Skips email discovery on the Microsoft sign-in page (e.g. google.com for Google social).
   * Use when `idp` is not set or in addition to it per tenant behavior.
   */
  domainHint?: string;
  /** Prefills the username/email field on the Microsoft sign-in page. */
  loginHint?: string;
};

export async function signIn(options?: EntraSignInOptions): Promise<{ kind: 'redirect' }> {
  const clientId = String(import.meta.env.VITE_ENTRA_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new Error('Entra sign-in is not configured for this environment.');
  }
  const authority = await entraSignInBase();
  const verifier = randomUrlSafe();
  const nonce = randomUrlSafe(16);
  sessionStorage.setItem(ENTRA_VERIFIER_KEY, verifier);
  const invite = captureInvite(window.location.search, sessionStorage);
  const challenge = await pkceChallenge(verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: entraScopes().join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: encodeState(nonce, invite),
    nonce,
  });
  const idp = String(options?.idp || '').trim();
  if (idp) {
    params.set('idp', idp);
  }
  const domainHint = String(options?.domainHint || '').trim();
  if (domainHint) {
    params.set('domain_hint', domainHint);
  }
  const loginHint = String(options?.loginHint || '').trim();
  if (loginHint) {
    params.set('login_hint', loginHint);
  }
  sessionStorage.setItem('renglo_oauth_nonce', nonce);
  window.location.assign(`${authority}/oauth2/v2.0/authorize?${params.toString()}`);
  return { kind: 'redirect' };
}

export async function completeRedirect(): Promise<AuthenticationResultType | null> {
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('error_description') || params.get('error');
  if (params.get('error')) {
    throw new Error(oauthError || 'Sign-in failed');
  }
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return null;
  }
  let parsed: { nonce: string };
  try {
    parsed = decodeState(state);
  } catch {
    throw new Error('Sign-in could not be verified.');
  }
  const expected = sessionStorage.getItem('renglo_oauth_nonce');
  const verifier = sessionStorage.getItem(ENTRA_VERIFIER_KEY);
  sessionStorage.removeItem('renglo_oauth_nonce');
  sessionStorage.removeItem(ENTRA_VERIFIER_KEY);
  if (!verifier || !expected || parsed.nonce !== expected) {
    throw new Error('Sign-in could not be verified.');
  }
  const clientId = String(import.meta.env.VITE_ENTRA_CLIENT_ID || '').trim();
  const authority = await entraSignInBase();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    code,
    code_verifier: verifier,
    scope: entraScopes().join(' '),
  });
  const response = await fetch(`${authority}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error_description?: string;
    error?: string;
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || 'Sign-in failed');
  }
  const idToken = payload.id_token;
  return {
    IdToken: idToken,
    AccessToken: bearerToken(idToken, payload.access_token || ''),
    RefreshToken: payload.refresh_token || '',
  };
}

export function signOut(): void {
  const clientId = String(import.meta.env.VITE_ENTRA_CLIENT_ID || '').trim();
  const tenant = String(import.meta.env.VITE_ENTRA_TENANT_ID || '').trim();
  const configured = String(import.meta.env.VITE_ENTRA_AUTHORITY || '').trim().replace(/\/$/, '');
  let authorityBase = '';
  if (configured) {
    authorityBase = configured.endsWith('/v2.0') ? configured.slice(0, -'/v2.0'.length) : configured;
  }
  let endSession = '';
  const cached = sessionStorage.getItem(ENTRA_OIDC_CACHE_KEY);
  if (cached) {
    try {
      const doc = JSON.parse(cached) as { end_session_endpoint?: string; base?: string };
      endSession = String(doc.end_session_endpoint || '').trim();
      if (!authorityBase) {
        authorityBase = String(doc.base || '').trim();
      }
    } catch {
      /* ignore */
    }
  }
  if (!authorityBase && tenant) {
    authorityBase = `https://${tenant}.ciamlogin.com/${tenant}`;
  }
  clearAuthSession(sessionStorage);
  const params = new URLSearchParams({
    post_logout_redirect_uri: `${window.location.origin}/login`,
  });
  if (clientId) {
    params.set('client_id', clientId);
  }
  const logoutTarget = endSession || (authorityBase ? `${authorityBase}/oauth2/v2.0/logout` : '');
  if (logoutTarget) {
    window.location.assign(`${logoutTarget}?${params.toString()}`);
  }
}
