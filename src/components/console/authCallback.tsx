import { useEffect, useState } from 'react';

import { finishAuthenticatedSession } from './authSession';
import { completeRedirect, persistAuthenticationResult } from './authClient';
import { Button } from '@/components/ui/button';

let exchangeStarted = false;

export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    if (exchangeStarted) {
      return;
    }
    exchangeStarted = true;

    completeRedirect()
      .then(async (result) => {
        if (result.kind === 'pending') {
          return;
        }
        if (result.kind === 'error') {
          exchangeStarted = false;
          setError(result.message);
          return;
        }
        persistAuthenticationResult(result.tokens);
        await finishAuthenticatedSession(result.tokens);
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
