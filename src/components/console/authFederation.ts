/**
 * One OAuth redirect for every identity provider.
 * The invite id is authorization context and stays out of the provider name.
 */

export const INVITE_STORAGE_KEY = 'renglo_invite';
export const AUTH_PROVIDER_STORAGE_KEY = 'renglo_auth_provider';
export const PKCE_VERIFIER_STORAGE_KEY = 'renglo_pkce_verifier';
export const OAUTH_NONCE_STORAGE_KEY = 'renglo_oauth_nonce';

export const NATIVE_PROVIDER = 'COGNITO';

export type AuthProvider = {
  id: string;
  name: string;
  type: string;
  cognito_provider_name: string;
  enabled?: boolean;
  display_name: string;
  icon?: string;
  display_order?: number;
};

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

export function captureInvite(search: string, storage: KeyValueStore): string | null {
  const invite = new URLSearchParams(search).get('invite');
  if (invite) {
    storage.setItem(INVITE_STORAGE_KEY, invite);
    return invite;
  }
  return storage.getItem(INVITE_STORAGE_KEY);
}

export function readInvite(storage: KeyValueStore): string | null {
  return storage.getItem(INVITE_STORAGE_KEY);
}

export function clearAuthSession(storage: KeyValueStore): void {
  const invite = storage.getItem(INVITE_STORAGE_KEY);
  storage.clear();
  if (invite) {
    storage.setItem(INVITE_STORAGE_KEY, invite);
  }
}

export function providersForLogin(
  apiProviders: AuthProvider[] | null,
  options: { devFallback: boolean; reference: AuthProvider[] },
): AuthProvider[] {
  const enabled = (apiProviders || []).filter((item) => item.enabled !== false);
  if (enabled.length > 0) {
    return enabled;
  }
  if (options.devFallback) {
    return options.reference.filter((item) => item.enabled !== false);
  }
  return [];
}

export function externalProviders(providers: AuthProvider[]): AuthProvider[] {
  return providers
    .filter((item) => item.enabled !== false && item.type !== 'native')
    .slice()
    .sort((left, right) => (left.display_order || 0) - (right.display_order || 0));
}

export function showPasswordForm(providers: AuthProvider[]): boolean {
  if (providers.length === 0) {
    return true;
  }
  return providers.some((item) => item.type === 'native' && item.enabled !== false);
}

export function encodeState(nonce: string, invite: string | null): string {
  const payload = JSON.stringify({ n: nonce, i: invite || '' });
  return bytesToBase64Url(new TextEncoder().encode(payload));
}

export function decodeState(state: string): { nonce: string; invite: string } {
  const json = new TextDecoder().decode(base64UrlToBytes(state));
  const parsed = JSON.parse(json) as { n?: string; i?: string };
  if (!parsed || typeof parsed.n !== 'string') {
    throw new Error('Invalid state');
  }
  return { nonce: parsed.n, invite: typeof parsed.i === 'string' ? parsed.i : '' };
}

export function buildAuthorizeUrl(input: {
  domain: string;
  clientId: string;
  redirectUri: string;
  identityProvider: string;
  state: string;
  codeChallenge: string;
}): string {
  const host = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: input.redirectUri,
    identity_provider: input.identityProvider,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://${host}/oauth2/authorize?${params.toString()}`;
}

export function buildLogoutUrl(input: {
  domain: string;
  clientId: string;
  logoutUri: string;
}): string {
  const host = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const params = new URLSearchParams({
    client_id: input.clientId,
    logout_uri: input.logoutUri,
  });
  return `https://${host}/logout?${params.toString()}`;
}

export function randomUrlSafe(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function beginFederatedSignIn(input: {
  provider: AuthProvider;
  search: string;
  storage: KeyValueStore;
  domain: string;
  clientId: string;
  redirectUri: string;
}): Promise<string> {
  const invite = captureInvite(input.search, input.storage);
  const verifier = randomUrlSafe();
  const nonce = randomUrlSafe(16);
  input.storage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
  input.storage.setItem(OAUTH_NONCE_STORAGE_KEY, nonce);
  input.storage.setItem(AUTH_PROVIDER_STORAGE_KEY, input.provider.cognito_provider_name);
  const challenge = await pkceChallenge(verifier);
  return buildAuthorizeUrl({
    domain: input.domain,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    identityProvider: input.provider.cognito_provider_name,
    state: encodeState(nonce, invite),
    codeChallenge: challenge,
  });
}

export function notePasswordSignIn(storage: KeyValueStore): void {
  storage.setItem(AUTH_PROVIDER_STORAGE_KEY, NATIVE_PROVIDER);
}

export type OAuthReturn =
  | { ok: true; code: string; invite: string }
  | { ok: false; error: string };

export function readOAuthReturn(input: {
  query: string;
  storage: KeyValueStore;
}): OAuthReturn {
  const params = new URLSearchParams(input.query);
  const oauthError = params.get('error_description') || params.get('error');
  if (params.get('error')) {
    return { ok: false, error: oauthError || 'Sign-in failed' };
  }
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return { ok: false, error: 'Missing authorization code' };
  }
  let parsed: { nonce: string; invite: string };
  try {
    parsed = decodeState(state);
  } catch {
    return { ok: false, error: 'Invalid state' };
  }
  const expected = input.storage.getItem(OAUTH_NONCE_STORAGE_KEY);
  if (!expected || parsed.nonce !== expected) {
    return { ok: false, error: 'Invalid state' };
  }
  if (parsed.invite) {
    input.storage.setItem(INVITE_STORAGE_KEY, parsed.invite);
  }
  input.storage.removeItem(OAUTH_NONCE_STORAGE_KEY);
  return {
    ok: true,
    code,
    invite: input.storage.getItem(INVITE_STORAGE_KEY) || '',
  };
}

export async function exchangeAuthorizationCode(input: {
  domain: string;
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<{ IdToken?: string; AccessToken?: string; RefreshToken?: string }> {
  const host = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.verifier,
  });
  const response = await fetch(`https://${host}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    error_description?: string;
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!response.ok) {
    const message = payload.error_description || payload.error || 'Token exchange failed';
    throw new Error(message);
  }
  return {
    IdToken: payload.id_token,
    AccessToken: payload.access_token,
    RefreshToken: payload.refresh_token,
  };
}

export function takePkceVerifier(storage: KeyValueStore): string | null {
  const verifier = storage.getItem(PKCE_VERIFIER_STORAGE_KEY);
  storage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
  return verifier;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
