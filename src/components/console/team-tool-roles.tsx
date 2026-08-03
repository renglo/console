import { useContext, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { GlobalContext } from "@/components/console/global-context";

interface TeamToolRolesProps {
  teamId: string;
  teamName: string;
  toolId: string;
  toolName: string;
  /** Available roles from the tool entity catalog (portfolio.tools[tool].roles). */
  availableRoles: string[];
  /** Currently assigned roles for this team+tool (teams[t].tools[tool].roles). */
  assignedRoles: string[];
  refreshUp: () => void;
}

export default function TeamToolRoles({
  teamId,
  teamName,
  toolId,
  toolName,
  availableRoles,
  assignedRoles,
  refreshUp,
}: TeamToolRolesProps) {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("No GlobalProvider");
  }
  const { loadTree } = context;
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const assignedSet = useMemo(() => new Set(assignedRoles || []), [assignedRoles]);
  const catalog = availableRoles || [];

  const toggleRole = async (roleId: string, currentlyAssigned: boolean) => {
    setPending(roleId);
    const method = currentlyAssigned ? "DELETE" : "POST";
    const path = `${import.meta.env.VITE_API_URL}/_auth/teams/${teamId}/tools/${toolId}/roles/${encodeURIComponent(roleId)}`;

    try {
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.accessToken}`,
        },
      });

      if (!response.ok) {
        let message = "Failed to update role assignment.";
        try {
          const body = await response.json();
          if (body?.message) message = body.message;
        } catch {
          /* ignore */
        }
        toast({
          title: "Role update failed",
          description: message,
        });
        return;
      }

      toast({
        title: currentlyAssigned ? "Role removed" : "Role assigned",
        description: `${roleId} · ${teamName} · ${toolName}`,
      });
      await loadTree();
      refreshUp();
    } catch (error) {
      console.error(error);
      toast({
        title: "Role update failed",
        description: "Network error while updating role assignment.",
      });
    } finally {
      setPending(null);
    }
  };

  if (catalog.length === 0) {
    return (
      <span className="text-xxs italic text-muted-foreground">
        no roles defined
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {catalog.map((roleId) => {
        const checked = assignedSet.has(roleId);
        const busy = pending === roleId;
        return (
          <button
            key={roleId}
            type="button"
            disabled={busy}
            onClick={() => toggleRole(roleId, checked)}
            title={
              checked
                ? `Remove "${roleId}" from ${teamName}`
                : `Assign "${roleId}" to ${teamName}`
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xxs transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              checked
                ? "border-transparent bg-primary font-medium text-primary-foreground hover:bg-primary/80"
                : "border-dashed border-gray-300 text-muted-foreground hover:border-gray-400 hover:bg-accent hover:text-foreground",
              busy && "pointer-events-none opacity-50"
            )}
          >
            {busy ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : checked ? (
              <Check className="h-2.5 w-2.5" />
            ) : null}
            {roleId}
          </button>
        );
      })}
    </div>
  );
}
