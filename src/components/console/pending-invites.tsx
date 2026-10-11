import { useContext, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlobalContext } from '@/components/console/global-context';

type PendingInvite = {
  team_id: string;
  team_name: string;
  portfolio_name?: string;
};

export default function PendingInvites() {
  const context = useContext(GlobalContext);
  const loadTree = context?.loadTree;
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/_auth/user/invites`, {
          headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
        });
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) {
          setInvites(Array.isArray(body.document) ? body.document : []);
        }
      } catch {
        if (!cancelled) setInvites([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(teamId: string, decision: 'accept' | 'decline') {
    setBusy(teamId + decision);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/_auth/user/invites/${decision}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionStorage.accessToken}`,
          },
          body: JSON.stringify({ team_id: teamId }),
        },
      );
      if (response.ok) {
        setInvites((current) => current.filter((item) => item.team_id !== teamId));
        if (decision === 'accept') loadTree?.();
      }
    } finally {
      setBusy('');
    }
  }

  if (invites.length === 0) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {invites.map((invite) => (
        <div
          key={invite.team_id}
          className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 py-1"
        >
          <p className="min-w-0 flex-1">
            You have an invitation to join <strong>{invite.team_name}</strong>
            {invite.portfolio_name ? (
              <>
                {' '}
                in <strong>{invite.portfolio_name}</strong>
              </>
            ) : null}
            . Accept it to be added to that team.
          </p>
          <Button
            size="sm"
            disabled={busy !== ''}
            onClick={() => decide(invite.team_id, 'accept')}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== ''}
            onClick={() => decide(invite.team_id, 'decline')}
          >
            Decline
          </Button>
        </div>
      ))}
    </div>
  );
}
