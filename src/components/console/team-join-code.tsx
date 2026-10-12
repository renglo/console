import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type JoinDocument = { code?: string; team_id?: string } | null;

type TeamJoinCodeProps = {
  teamId: string;
};

export default function TeamJoinCode({ teamId }: TeamJoinCodeProps) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/_auth/teams/${teamId}/join`, {
      headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      setMessage(payload.message || 'Could not load the open invitation.');
      return;
    }
    setCode(payload.document?.code || '');
    setMessage('');
  };

  useEffect(() => {
    load().catch(() => setMessage('Could not load the open invitation.'));
  }, [teamId]);

  const send = async (path: string, method: string) => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        setMessage(payload.message || 'Could not update the open invitation.');
        return;
      }
      const document = payload.document as JoinDocument;
      setCode(document?.code || '');
    } catch {
      setMessage('Could not update the open invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Open invitation</p>
      <p className="text-xs text-muted-foreground">
        Share this code like a meeting link. People who use it request access and stay pending until you approve them.
      </p>
      {code ? (
        <p className="font-mono text-sm tracking-wide">{code}</p>
      ) : (
        <p className="text-xs text-muted-foreground">No open code yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {code ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => navigator.clipboard.writeText(code)}
          >
            Copy
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={() => send(`/_auth/teams/${teamId}/join`, 'POST')}>
            Create code
          </Button>
        )}
        {code && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => send(`/_auth/teams/${teamId}/join/regenerate`, 'POST')}
            >
              Regenerate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => send(`/_auth/teams/${teamId}/join`, 'DELETE')}
            >
              Revoke
            </Button>
          </>
        )}
      </div>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  );
}
