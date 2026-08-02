import * as CryptoJS from 'crypto-js';
import type { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseJwt(token: any) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
      .join(''),
  );
  return JSON.parse(jsonPayload);
}

export function getAccessTokenClaims(): Record<string, string> {
  const token = sessionStorage.getItem('accessToken');
  if (!token) {
    return {};
  }
  return parseJwt(token);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function getHandle(input: string): string {
  return CryptoJS.MD5(input).toString().substring(0, 9);
}

export type UserProfilePatch = {
  name?: string;
  slot_a?: string;
  email?: string;
};

export async function finishAuthenticatedSession(
  tokens: AuthenticationResultType,
  profile: UserProfilePatch = {},
) {
  if (!tokens.AccessToken) {
    throw new Error('Session token was not set properly.');
  }

  sessionStorage.setItem('accessToken', tokens.AccessToken);

  const accessToken = parseJwt(sessionStorage.accessToken.toString());
  const idToken = parseJwt(sessionStorage.idToken.toString());
  const handle = getHandle(accessToken.username);
  sessionStorage.setItem('token_exp', idToken.exp);
  sessionStorage.setItem('cu_handle', handle);
  sessionStorage.setItem('cu_email', idToken.email || profile.email || '');
  sessionStorage.setItem('cu_first', idToken.given_name || profile.name || '');
  sessionStorage.setItem('cu_last', idToken.family_name || profile.slot_a || '');

  const payload: Record<string, unknown> = { last_login: true };
  if (profile.name) {
    payload.name = profile.name;
  }
  if (profile.slot_a) {
    payload.slot_a = profile.slot_a;
  }
  if (profile.email) {
    payload.email = profile.email;
  }

  const putResponse = await fetch(`${import.meta.env.VITE_API_URL}/_auth/user`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionStorage.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!putResponse.ok) {
    const body = await putResponse.json().catch(() => ({}));
    throw new Error(body.message || 'Could not save your profile.');
  }

  if (!sessionStorage.getItem('accessToken')) {
    throw new Error('Session token was not set properly.');
  }

  window.location.href = '/home';
}
