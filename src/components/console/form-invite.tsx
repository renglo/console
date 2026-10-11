import { FormEvent, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast"
import InviteActions, { InviteDocument } from '@/components/console/invite-actions';

interface FormPutProps {
    team_id: string;
    portfolio_id: any;
    refreshUp: () => void;
    path: string;
    method: string;
}


export default function FormInvite({ team_id, portfolio_id, refreshUp, path, method }: FormPutProps) {
    const { toast } = useToast();
    const [invite, setInvite] = useState<InviteDocument | null>(null);
    const [email, setEmail] = useState('');

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(path, {
                method: method,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionStorage.accessToken}`,
                },
                body: JSON.stringify(data),
            });

            const rs = await response.json();
            if (response.ok && rs.document?.email) {
                setEmail(String(rs.document.email));
                setInvite(rs.document);
                refreshUp();
                toast({
                    title: "Invitation is ready",
                    description: "Copy the link, or send it by email.",
                });
                return;
            }
            toast({
                title: "Invitation",
                description: rs.message || "Could not create the invitation.",
            });
        } catch (error) {
            console.error('Error:', error);
            toast({
                title: "Invitation",
                description: "Could not create the invitation.",
            });
        }
    };

    if (invite) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm">
                    Invitation for <span className="font-medium">{email}</span> is ready.
                </p>
                <InviteActions
                    invite={invite}
                    teamId={team_id}
                    portfolioId={String(portfolio_id)}
                    onUpdated={(next) => {
                        setInvite(next);
                        refreshUp();
                    }}
                />
                <Button type="button" variant="ghost" onClick={() => setInvite(null)}>
                    Invite someone else
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
                <label>e-mail</label>
                <input
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                />
                <input name="team_id" type="hidden" readOnly value={team_id} />
                <input name="portfolio_id" type="hidden" readOnly value={portfolio_id} />
                <Button>Create invitation</Button>
            </div>
        </form>
    );
}
