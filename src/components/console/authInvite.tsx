import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    InputOTPSeparator,
} from "@/components/ui/input-otp"
import { toast } from "@/components/ui/use-toast"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLocation } from 'react-router-dom';

import { useEffect, useState, FormEvent, useMemo } from 'react';
import { completeNewPasswordChallenge, signIn } from './authService';
import { finishAuthenticatedSession } from './authSession';
import { inviteEmailSubjectHint, locales, wlLogoUrl } from '@/lib/branding';
import referenceDocument from '@/auth/reference-providers.json';
import {
  beginFederatedSignIn,
  externalProviders,
  INVITE_STORAGE_KEY,
  providersForLogin,
  type AuthProvider,
} from './authFederation';

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


export default function AuthInvite() {
  const location = useLocation();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const isPasswordSetup = queryParams.get('setup') === 'admin';
  const loginTempPassword =
    typeof location.state === 'object' &&
    location.state !== null &&
    'tempPassword' in location.state &&
    typeof (location.state as { tempPassword?: unknown }).tempPassword === 'string'
      ? (location.state as { tempPassword: string }).tempPassword
      : '';

  const [email, setEmail] = useState(queryParams.get('email') ?? '');
  const linkCode = queryParams.get('code') ?? '';
  const openedFromLink = linkCode.length > 6;
  const [code, setCode] = useState(linkCode);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [tempPassword, setTempPassword] = useState(loginTempPassword);
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [warning, setWarning] = useState('');
  const [providers, setProviders] = useState<AuthProvider[] | null>(null);
  const [showNative, setShowNative] = useState(false);

  useEffect(() => {
    if (linkCode) {
      sessionStorage.setItem(INVITE_STORAGE_KEY, linkCode);
    }
  }, [linkCode]);

  useEffect(() => {
    if (isPasswordSetup) {
      return undefined;
    }
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
  }, [isPasswordSetup]);

  const federated = providers ? externalProviders(providers) : [];

  const handleProvider = async (provider: AuthProvider) => {
    setWarning('');
    if (linkCode) {
      sessionStorage.setItem(INVITE_STORAGE_KEY, linkCode);
    }
    const domain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;
    if (!domain || !clientId) {
      setWarning('Sign-in is not configured for this environment.');
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
        loginHint: email.trim(),
      });
      window.location.assign(url);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Sign-in failed');
    }
  };

  const handleTeamInviteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        const accessToken = sessionStorage.getItem('accessToken');
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL}/_auth/user/invite`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                email,
                code,
                first,
                last,
                pass,
            }),
        });

        const rs = await response.json();

        if (response.ok) {
            toast({
            title: "Validation ok",
            description: (
                <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                <code className="text-white">Validation ok. Creating your account. </code>
                </pre>
            ),
            });

            alert("Account confirmed.\nSign in, then accept the invitation on your home page.");
            window.location.href = `/login?email=${encodeURIComponent(email)}`;
        } else {
            setWarning(rs.message || 'Invite could not be completed.');
        }
    } catch (error) {
      setWarning(String(error));
    }
  };

  const handleAdminSetupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWarning('');

    if (pass !== confirmPass) {
      setWarning('New passwords do not match.');
      return;
    }

    if (pass.length < 8) {
      setWarning('New password must be at least 8 characters.');
      return;
    }

    try {
      const signInResult = await signIn(email, tempPassword);

      if (signInResult.kind !== 'new_password_required') {
        setWarning('This account is already set up. Sign in instead.');
        return;
      }

      const tokens = await completeNewPasswordChallenge(
        signInResult.username,
        pass,
        signInResult.session,
        {
          given_name: first,
          family_name: last,
        },
      );

      await finishAuthenticatedSession(tokens, {
        name: first,
        slot_a: last,
        email,
      });
    } catch (error) {
      setWarning(String(error));
    }
  };

  const nameFields = (
    <div className="grid grid-cols-2 gap-4">
      <div className="grid gap-2">
        <Label htmlFor="first-name">First name</Label>
        <Input
          id="first-name"
          placeholder="Max"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="last-name">Last name</Label>
        <Input
          id="last-name"
          placeholder="Robinson"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          required
        />
      </div>
    </div>
  );

  return (
    <Card className="mx-auto max-w-sm mt-16">
      <CardHeader>
        <CardTitle className="text-xl">
            <div className="flex mb-6">
            {isPasswordSetup ? 'Set up your account' : 'You have an invitation'}
            <img src={wlLogoUrl()} className="w-[40px] ml-auto" alt={locales.en.appName || "Logo"} />
            </div>
        </CardTitle>
        <CardDescription>
          {isPasswordSetup ? (
            <>
              Enter the temporary password from your invitation email, your name, and a new password.
              <div className="text-xs mt-1">
                Copy the temporary password exactly — do not include the period at the end of the sentence.
              </div>
            </>
          ) : showNative || (providers !== null && federated.length === 0) ? (
            <>
              {openedFromLink ? (
                <>Create a username and password for {email || 'your email'}.</>
              ) : (
                <>
                  Enter the invitation code we sent to your email
                  <div className="text-xs">(The message has the subject: &quot;{inviteEmailSubjectHint()}&quot;)</div>
                </>
              )}
            </>
          ) : (
            <>
              You were invited{email ? <> as {email}</> : null}. Sign in with that address, or create a username and password. After you sign in, accept the invitation to join the team.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPasswordSetup ? (
          <form onSubmit={handleAdminSetupSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Your email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="temp-password">Temporary password</Label>
                <Input
                  id="temp-password"
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="From your invitation email"
                  required
                />
              </div>

              {nameFields}

              <div className="grid gap-2">
                <Label htmlFor="password">Your new password</Label>
                <Input
                  id="password"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                />
              </div>

              <div className="text-xs text-red-500">{warning}</div>
              <Button type="submit" className="w-full">
                Complete setup
              </Button>
              <div className="text-center text-sm">
                <a href="/login" className="underline">
                  Already set up? Sign in
                </a>
              </div>
            </div>
          </form>
        ) : !showNative && (providers === null || federated.length > 0) ? (
          <div className="grid gap-4">
            {providers === null ? (
              <p className="text-sm text-muted-foreground">Loading sign-in options…</p>
            ) : (
              federated.map((provider) => (
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
              ))
            )}
            {email ? (
              <p className="text-xs text-muted-foreground">
                Use {email}. A different address does not receive this invitation.
              </p>
            ) : null}
            <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">or</div>
            <Button type="button" className="w-full" onClick={() => setShowNative(true)}>
              Create a username and password
            </Button>
            {warning ? <div className="text-xs text-red-500">{warning}</div> : null}
          </div>
        ) : (
          <form onSubmit={handleTeamInviteSubmit}>
            <div className="grid gap-4">
                {openedFromLink ? null : (
                <div className="grid grid-cols-2 gap-4">
                    <InputOTP
                        maxLength={6}
                        value={code}
                        onChange={(value) => setCode(value)}
                        data-1p-ignore
                    >
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                </div>
                )}

                {nameFields}

                <div className="grid gap-2">
                    <Label htmlFor="email">Your email <div className="text-xs">(where the invitation was sent to)</div></Label>
                    <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="password">Your new password</Label>
                    <Input
                    id="password"
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    required
                    />
                </div>
                <div className="text-xs text-red-500">{warning}</div>
                <Button type="submit" className="w-full">
                    Create account
                </Button>
                {federated.length > 0 ? (
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setShowNative(false)}>
                    Use an identity provider instead
                  </Button>
                ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
