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

import { useState, FormEvent, useMemo } from 'react';
import { completeNewPasswordChallenge, signIn } from './authService';
import { finishAuthenticatedSession } from './authSession';


interface TransactionType {
    success?: string;
    status?: string;
    [key: string]: any;
}

export default function AuthInvite() {
  const location = useLocation();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const isAdminSetup = queryParams.get('setup') === 'admin';

  const [email, setEmail] = useState(queryParams.get('email') ?? '');
  const [code, setCode] = useState(queryParams.get('code') ?? '');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [transaction, setTransaction] = useState<TransactionType>({});
  const [warning, setWarning] = useState('');

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
        setTransaction(rs);

        if (response.ok) {
            toast({
            title: "Validation ok",
            description: (
                <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                <code className="text-white">Validation ok. Creating your account. </code>
                </pre>
            ),
            });

            alert("Account confirmed successfully!\nSign in on next page.");
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
        setWarning('This account is already set up. Sign in at /login instead.');
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
            {isAdminSetup ? 'Set up your admin account' : 'Access your new team'}
            <img src={`${import.meta.env.VITE_WL_LOGO}`} className="w-[40px] ml-auto" alt="Logo" />
            </div>
        </CardTitle>
        <CardDescription>
          {isAdminSetup ? (
            <>
              Enter the temporary password from your Cognito email, your name, and a new password.
              <div className="text-xs mt-1">
                Copy the temporary password exactly — do not include the period at the end of the sentence.
              </div>
            </>
          ) : (
            <>
              Enter the invitation code we sent to your email
              <div className="text-xs">(The message has the subject: &quot;You have been invited to a new team&quot;)</div>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isAdminSetup ? (
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
                  placeholder="From your Cognito email"
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
        ) : (
          <form onSubmit={handleTeamInviteSubmit}>
            <div className="grid gap-4">
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
                    Confirm
                </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
