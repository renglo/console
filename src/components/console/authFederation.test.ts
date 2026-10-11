import assert from 'node:assert/strict';
import test from 'node:test';

import referenceDocument from '../../auth/reference-providers.json' with { type: 'json' };
import {
  AUTH_PROVIDER_STORAGE_KEY,
  INVITE_STORAGE_KEY,
  OAUTH_NONCE_STORAGE_KEY,
  beginFederatedSignIn,
  buildAuthorizeUrl,
  clearAuthSession,
  decodeState,
  encodeState,
  externalProviders,
  notePasswordSignIn,
  providersForLogin,
  readOAuthReturn,
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
});
