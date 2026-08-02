
import { useState } from 'react';
    
import { completeNewPasswordChallenge, signIn } from './authService';
import { finishAuthenticatedSession } from './authSession';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLocation } from 'react-router-dom';


export default function AuthLogin() {

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    
    const [email, setEmail] = useState(queryParams.get('email') ?? '');
    const [password, setPassword] = useState('');

    const handleSignIn = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        try {
          if (!email || !password) {
            throw new Error("Email and password must be provided");
          }

          const result = await signIn(email, password);

          if (result.kind === 'new_password_required') {
            window.location.href = `/invite?setup=admin&email=${encodeURIComponent(email)}`;
            return;
          }

          await finishAuthenticatedSession(result.tokens);
        } catch (error) {
          alert(`Sign in failed: ${error}`);
        }
      };


    const backgroundUrl = import.meta.env.VITE_WL_BACKGROUND;

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
                  <h1 className="text-3xl font-bold">Login</h1>
                  <p className="text-balance text-muted-foreground">
                  Enter your email below to login to your account
                  </p>
              </div>
              <div className="grid gap-4">
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
                      <Button type="submit" className="w-full">
                      Login
                      </Button>
                  </form>
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
