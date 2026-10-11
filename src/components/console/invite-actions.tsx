import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export interface InviteDocument {
  email: string;
  link?: string;
  expires_at?: number;
  expired?: boolean;
  membership?: string;
}

interface InviteActionsProps {
  invite: InviteDocument;
  teamId: string;
  portfolioId: string;
  onUpdated: (invite: InviteDocument) => void;
}

async function postInvite(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionStorage.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export default function InviteActions({
  invite,
  teamId,
  portfolioId,
  onUpdated,
}: InviteActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'email' | 'link' | ''>('');
  const api = import.meta.env.VITE_API_URL;
  const body = {
    email: invite.email,
    team_id: teamId,
    portfolio_id: portfolioId,
  };

  const fail = (message: string) => {
    toast({ title: 'Invitation', description: message || 'Could not update the invitation.' });
  };

  const copyLink = async () => {
    if (!invite.link) {
      return;
    }
    await navigator.clipboard.writeText(invite.link);
    toast({ title: 'Link copied' });
  };

  const sendEmail = async () => {
    setBusy('email');
    try {
      const { ok, payload } = await postInvite(`${api}/_auth/user/invite/email`, body);
      if (!ok) {
        fail(payload.message);
        return;
      }
      toast({ title: 'Invitation email sent' });
      if (payload.document) {
        onUpdated(payload.document);
      }
    } finally {
      setBusy('');
    }
  };

  const regenerate = async () => {
    setBusy('link');
    try {
      const { ok, payload } = await postInvite(`${api}/_auth/user/invite/link`, body);
      if (!ok) {
        fail(payload.message);
        return;
      }
      toast({ title: 'New invitation link ready' });
      if (payload.document) {
        onUpdated(payload.document);
      }
    } finally {
      setBusy('');
    }
  };

  const expires = invite.expires_at
    ? new Date(invite.expires_at * 1000).toLocaleString()
    : '';

  return (
    <div className="grid gap-2">
      {invite.expired ? (
        <p className="text-sm text-muted-foreground">This invitation link has expired.</p>
      ) : invite.link ? (
        <>
          <label className="text-sm">Invitation link</label>
          <input
            readOnly
            value={invite.link}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          {expires ? (
            <p className="text-xs text-muted-foreground">Link works until {expires}.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              Copy link
            </Button>
            <Button type="button" variant="outline" disabled={busy !== ''} onClick={sendEmail}>
              {busy === 'email' ? 'Sending…' : 'Send this invitation via email'}
            </Button>
          </div>
        </>
      ) : null}
      <Button type="button" variant="ghost" disabled={busy !== ''} onClick={regenerate}>
        {busy === 'link' ? 'Generating…' : 'Generate a new link'}
      </Button>
    </div>
  );
}
