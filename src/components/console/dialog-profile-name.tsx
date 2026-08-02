import { FormEvent, useEffect, useState } from 'react';
import { UserRoundPen } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAccessTokenClaims } from '@/components/console/authSession';

function profileNamesFromToken() {
  const claims = getAccessTokenClaims();
  return {
    first: claims.given_name || sessionStorage.getItem('cu_first') || '',
    last: claims.family_name || sessionStorage.getItem('cu_last') || '',
  };
}

export default function DialogProfileName() {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    const { first: tokenFirst, last: tokenLast } = profileNamesFromToken();
    setFirst(tokenFirst);
    setLast(tokenLast);
    setError('');
  }, [open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      setError('You are not signed in.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/_auth/user/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ first, last }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Could not update profile.');
        return;
      }

      sessionStorage.setItem('cu_first', first);
      sessionStorage.setItem('cu_last', last);
      setOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Change first and last name"
        >
          <UserRoundPen className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change First/Last name</DialogTitle>
          <DialogDescription>
            Update the name shown on your account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input
                id="profile-first-name"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-last-name">Last name</Label>
              <Input
                id="profile-last-name"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
