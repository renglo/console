import { useEffect, useState } from 'react';

import { signIn } from './authService';
import { finishAuthenticatedSession } from './authSession';
import { captions, wlBackgroundUrl, wlLoginLogoUrl } from '@/lib/branding';
import referenceDocument from '@/auth/reference-providers.json';
import {
  beginFederatedSignIn,
  captureInvite,
  externalProviders,
  notePasswordSignIn,
  providersForLogin,
  showPasswordForm,
  type AuthProvider,
} from './authFederation';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLocation, useNavigate } from 'react-router-dom';

const referenceProviders = referenceDocument.providers as AuthProvider[];

function ProviderMark({ icon }: { icon?: string }) {
  const letter = (icon || 'id').slice(0, 1).toUpperCase();
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold"
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export default function AuthLogin() {

    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    
    const [email, setEmail] = useState(queryParams.get('email') ?? '');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [providers, setProviders] = useState<AuthProvider[]>([]);

    useEffect(() => {
      captureInvite(location.search, sessionStorage);
      let cancelled = false;
      const devFallback = import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true';
      (async () => {
        let apiProviders: AuthProvider[] | null = null;
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/_auth/providers`);
          if (response.ok) {
            const body = await response.json();
            apiProviders = Array.isArray(body.providers) ? body.providers : [];
          }
        } catch {
          apiProviders = null;
        }
        if (!cancelled) {
          setProviders(providersForLogin(apiProviders, {
            devFallback,
            reference: referenceProviders,
          }));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [location.search]);

    const handleSignIn = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        setError('');
        try {
          if (!email || !password) {
            throw new Error("Email and password must be provided");
          }

          const result = await signIn(email, password);

          if (result.kind === 'new_password_required') {
            navigate(`/invite?setup=admin&email=${encodeURIComponent(email)}`, {
              state: { tempPassword: password },
            });
            return;
          }

          notePasswordSignIn(sessionStorage);
          await finishAuthenticatedSession(result.tokens);
        } catch (err) {
          setError(`Sign in failed: ${err}`);
        }
      };

    const handleProvider = async (provider: AuthProvider) => {
      setError('');
      const domain = import.meta.env.VITE_COGNITO_DOMAIN;
      const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;
      if (!domain || !clientId) {
        setError('Sign-in is not configured for this environment.');
        return;
      }
      try {
        const url = await beginFederatedSignIn({
          provider,
          search: location.search,
          storage: sessionStorage,
          domain,
          clientId,
          redirectUri: `${window.location.origin}/callback`,
        });
        window.location.assign(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        setError(message);
      }
    };

    const backgroundUrl = wlBackgroundUrl();
    const logoUrl = wlLoginLogoUrl();
    const federated = externalProviders(providers);
    const passwordEnabled = showPasswordForm(providers);

    return (
        <div
          className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat"
          style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
        >
          {backgroundUrl && (
            <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          )}
          <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
            <div className="mx-auto grid w-full max-w-[400px] gap-6 rounded-lg border bg-background/95 p-8 shadow-lg backdrop-blur-sm">
              <div className="grid gap-2 text-center">
                  {logoUrl && (
                    <img src={logoUrl} alt="" className="mx-auto h-16 w-auto" />
                  )}
                  <h1 className="text-3xl font-bold">{captions.loginTitle}</h1>
                  <p className="text-balance text-muted-foreground">
                  {captions.loginSubtitle}
                  </p>
              </div>
              <div className="grid gap-4">
                  {passwordEnabled && (
                  <form onSubmit={handleSignIn} >
                      <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="m@example.com"
                          required
                      />
                      </div>
                      <div className="grid gap-2">
                      <div className="flex items-center">
                          <Label htmlFor="password">Password</Label>
                          <a
                          href="/forgot"
                          className="ml-auto inline-block text-sm underline"
                          >
                          Forgot your password?
                          </a>
                      </div>
                      <Input 
                          id="password" 
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          required 
                      />
                      </div>
                      {error && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                          <p>{error}</p>
                        </div>
                      )}
                      <Button type="submit" className="w-full">
                      Login
                      </Button>
                  </form>
                  )}
                  {!passwordEnabled && error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      <p>{error}</p>
                    </div>
                  )}
                  {federated.length > 0 && passwordEnabled && (
                    <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">or</div>
                  )}
                  {federated.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => { void handleProvider(provider); }}
                    >
                      <ProviderMark icon={provider.icon} />
                      {provider.display_name}
                    </Button>
                  ))}
              </div>
              <div className="mt-4 text-center text-sm hidden">
                  Don&apos;t have an account?{" "}
                  <a href="/register" className="underline">
                  Create one here
                  </a>
              </div>
            </div>
          </div>
        </div>
    )
}
