import { useEffect, useState } from 'react';

import { persistAuthenticationResult } from './authService';
import { finishAuthenticatedSession } from './authSession';
import {
  exchangeAuthorizationCode,
  readOAuthReturn,
  takePkceVerifier,
} from './authFederation';
import { Button } from '@/components/ui/button';

let exchangeStarted = false;

export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    if (exchangeStarted) {
      return;
    }
    exchangeStarted = true;

    const returned = readOAuthReturn({
      query: window.location.search,
      storage: sessionStorage,
    });
    if (!returned.ok) {
      exchangeStarted = false;
      setError(returned.error);
      return;
    }

    const verifier = takePkceVerifier(sessionStorage);
    const domain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;
    if (!verifier || !domain || !clientId) {
      exchangeStarted = false;
      setError('Sign-in could not be verified.');
      return;
    }

    exchangeAuthorizationCode({
      domain,
      clientId,
      redirectUri: `${window.location.origin}/callback`,
      code: returned.code,
      verifier,
    })
      .then(async (tokens) => {
        persistAuthenticationResult(tokens);
        await finishAuthenticatedSession(tokens);
      })
      .catch((err: unknown) => {
        exchangeStarted = false;
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        setError(message);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="grid w-full max-w-[400px] gap-4 rounded-lg border bg-background p-8 shadow-lg">
        <h1 className="text-2xl font-bold">Signing in</h1>
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild className="w-full">
              <a href="/login">Back to login</a>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        )}
      </div>
    </div>
  );
}
