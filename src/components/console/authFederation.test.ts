import assert from 'node:assert/strict';
import test from 'node:test';

import referenceDocument from '../../auth/reference-providers.json' with { type: 'json' };
import {
  ACCOUNT_LINK_RETRY_KEY,
  AUTH_PROVIDER_STORAGE_KEY,
  INVITE_STORAGE_KEY,
  OAUTH_NONCE_STORAGE_KEY,
  beginFederatedSignIn,
  buildAuthorizeUrl,
  clearAuthSession,
  decodeState,
  encodeState,
  externalProviders,
  maybeRetryLinkedAccount,
  notePasswordSignIn,
  providersForLogin,
  readOAuthReturn,
  signInErrorMessage,
  type AuthProvider,
  type KeyValueStore,
} from './authFederation.ts';

const reference = referenceDocument.providers as AuthProvider[];

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
    clear() {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },
    dump() {
      return { ...data };
    },
  };
}

test('reference login offers email, Google, and Okta', () => {
  const providers = providersForLogin(null, { devFallback: true, reference });
  assert.deepEqual(
    externalProviders(providers).map((item) => item.display_name),
    ['Continue with Google', 'Continue with Okta'],
  );
  assert.equal(providers.some((item) => item.type === 'native'), true);
});

test('an API list replaces the reference document', () => {
  const api = [reference[1]];
  const providers = providersForLogin(api, { devFallback: true, reference });
  assert.deepEqual(providers.map((item) => item.id), ['google']);
});

test('production with an empty list does not invent providers', () => {
  assert.deepEqual(providersForLogin([], { devFallback: false, reference }), []);
});

test('Google and Okta each redirect with their own provider and PKCE', async () => {
  const invite = '11111111-1111-4111-8111-111111111111';
  for (const name of ['Google', 'Okta']) {
    const storage = memoryStore();
    const provider = reference.find((item) => item.cognito_provider_name === name);
    assert.ok(provider);
    const url = await beginFederatedSignIn({
      provider,
      search: `?invite=${invite}`,
      storage,
      domain: 'example.auth.us-east-1.amazoncognito.com',
      clientId: 'client',
      redirectUri: 'http://localhost:5173/callback',
      });
    const params = new URL(url).searchParams;
    assert.equal(params.get('identity_provider'), name);
    assert.equal(params.get('code_challenge_method'), 'S256');
    assert.ok(params.get('code_challenge'));
    assert.equal(params.get('invite'), null);
    assert.equal(decodeState(params.get('state') || '').invite, invite);
    assert.equal(storage.getItem(INVITE_STORAGE_KEY), invite);
  }
});

test('a bad state does not restore a code and a good return keeps the invite', () => {
  const storage = memoryStore();
  const invite = '22222222-2222-4222-8222-222222222222';
  const nonce = 'nonce-1';
  storage.setItem(OAUTH_NONCE_STORAGE_KEY, nonce);
  const bad = readOAuthReturn({
    query: '?code=abc&state=not-valid',
    storage,
  });
  assert.equal(bad.ok, false);
  assert.equal(storage.getItem(INVITE_STORAGE_KEY), null);

  const good = readOAuthReturn({
    query: `?code=abc&state=${encodeURIComponent(encodeState(nonce, invite))}`,
    storage,
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.code, 'abc');
    assert.equal(good.invite, invite);
  }
  assert.equal(storage.getItem(INVITE_STORAGE_KEY), invite);
});

test('password sign-in and logout keep the invite id', () => {
  const storage = memoryStore();
  storage.setItem(INVITE_STORAGE_KEY, 'invite-uuid');
  storage.setItem('accessToken', 'token');
  notePasswordSignIn(storage);
  assert.equal(storage.getItem(AUTH_PROVIDER_STORAGE_KEY), 'COGNITO');
  assert.equal(storage.getItem(INVITE_STORAGE_KEY), 'invite-uuid');
  clearAuthSession(storage);
  assert.equal(storage.getItem('accessToken'), null);
  assert.equal(storage.getItem(INVITE_STORAGE_KEY), 'invite-uuid');
});

test('a linked account restarts the same provider once', async () => {
  const storage = memoryStore({
    [AUTH_PROVIDER_STORAGE_KEY]: 'Google',
    [INVITE_STORAGE_KEY]: 'invite-uuid',
  });
  const url = await maybeRetryLinkedAccount({
    error: 'PreSignUp failed with error ACCOUNT_LINKED.',
    storage,
    search: '?error=invalid_request',
    domain: 'example.auth.us-east-1.amazoncognito.com',
    clientId: 'client',
    redirectUri: 'http://127.0.0.1:5174/callback',
  });
  assert.ok(url);
  assert.equal(new URL(url || '').searchParams.get('identity_provider'), 'Google');
  assert.equal(storage.getItem(ACCOUNT_LINK_RETRY_KEY), '1');
  assert.equal(decodeState(new URL(url || '').searchParams.get('state') || '').invite, 'invite-uuid');

  const second = await maybeRetryLinkedAccount({
    error: 'PreSignUp failed with error ACCOUNT_LINKED.',
    storage,
    search: '',
    domain: 'example.auth.us-east-1.amazoncognito.com',
    clientId: 'client',
    redirectUri: 'http://127.0.0.1:5174/callback',
  });
  assert.equal(second, null);
  assert.equal(
    signInErrorMessage('PreSignUp failed with error ACCOUNT_LINKED.'),
    'This sign-in is linked to your existing account. Choose it again from the login page.',
  );
});

test('a fresh provider click clears a previous link retry', async () => {
  const storage = memoryStore({ [ACCOUNT_LINK_RETRY_KEY]: '1' });
  const provider = reference.find((item) => item.cognito_provider_name === 'Google');
  assert.ok(provider);
  await beginFederatedSignIn({
    provider,
    search: '',
    storage,
    domain: 'example.auth.us-east-1.amazoncognito.com',
    clientId: 'client',
    redirectUri: 'http://127.0.0.1:5174/callback',
  });
  assert.equal(storage.getItem(ACCOUNT_LINK_RETRY_KEY), null);
});

test('authorize URL helper does not add an invite query parameter', () => {
  const url = buildAuthorizeUrl({
    domain: 'https://example.auth.us-east-1.amazoncognito.com',
    clientId: 'client',
    redirectUri: 'http://localhost:5173/callback',
    identityProvider: 'Google',
    state: encodeState('n', 'invite-uuid'),
    codeChallenge: 'challenge',
  });
  assert.equal(new URL(url).searchParams.get('invite'), null);
  assert.equal(new URL(url).searchParams.get('identity_provider'), 'Google');
  assert.equal(new URL(url).searchParams.get('login_hint'), null);
});

test('authorize URL can hint the invited email', () => {
  const url = buildAuthorizeUrl({
    domain: 'example.auth.us-east-1.amazoncognito.com',
    clientId: 'client',
    redirectUri: 'http://127.0.0.1:5174/callback',
    identityProvider: 'Google',
    state: encodeState('n', 'invite-code'),
    codeChallenge: 'challenge',
    loginHint: 'ada@example.com',
  });
  assert.equal(new URL(url).searchParams.get('login_hint'), 'ada@example.com');
  assert.equal(new URL(url).searchParams.get('invite'), null);
});
