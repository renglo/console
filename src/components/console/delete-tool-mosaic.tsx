import { FormEvent, useContext, useEffect, useMemo, useState } from "react";
import { Eraser } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { GlobalContext } from "@/components/console/global-context";

export default function DeleteToolMosaic() {
  const { toast } = useToast();
  const context = useContext(GlobalContext);
  const tree = context?.tree;

  const portfolioOptions = useMemo(() => {
    const portfolios = tree?.portfolios || {};
    return Object.entries(portfolios).map(([id, doc]) => ({
      id,
      name: (doc as { name?: string })?.name || id,
    }));
  }, [tree]);

  const [open, setOpen] = useState(false);
  const [portfolioId, setPortfolioId] = useState("");
  const [toolId, setToolId] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setToolId("");
      setConfirmId("");
      setSaving(false);
      return;
    }
    if (!portfolioId && portfolioOptions[0]?.id) {
      setPortfolioId(portfolioOptions[0].id);
    }
  }, [open, portfolioId, portfolioOptions]);

  const trimmedPortfolio = portfolioId.trim();
  const trimmedTool = toolId.trim();
  const canSubmit =
    Boolean(trimmedPortfolio) &&
    Boolean(trimmedTool) &&
    confirmId.trim() === trimmedTool &&
    !saving;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      toast({
        title: "Error",
        description: "You are not signed in.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/_auth/portfolios/${trimmedPortfolio}/tools/${trimmedTool}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name: trimmedTool, tool_id: trimmedTool }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Delete failed",
          description: result?.message || "Could not run the delete-tool funnel.",
        });
        return;
      }

      await fetch(`${import.meta.env.VITE_API_URL}/_auth/tree/refresh`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      await context?.loadTree();

      toast({
        title: "Extension deleted",
        description: `Ran the delete funnel for ${trimmedTool} in ${trimmedPortfolio}.`,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: String(error),
      });
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
          aria-label="Delete extension by id"
        >
          <Eraser className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete extension (tool)</DialogTitle>
          <DialogDescription>
            Re-run the delete-tool funnel for a specific extension id, including
            leftover entities that no longer appear on a card.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="rounded-md border p-6">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="delete-tool-portfolio">Portfolio id</Label>
              <Input
                id="delete-tool-portfolio"
                list="delete-tool-portfolios"
                value={portfolioId}
                onChange={(event) => setPortfolioId(event.target.value)}
                placeholder="8c38e9a6bd5d"
                autoComplete="off"
              />
              {portfolioOptions.length > 0 && (
                <datalist id="delete-tool-portfolios">
                  {portfolioOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </datalist>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="delete-tool-id">Tool / extension id</Label>
              <Input
                id="delete-tool-id"
                value={toolId}
                onChange={(event) => setToolId(event.target.value)}
                placeholder="abf4d6835907"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="delete-tool-confirm">
                Type the tool id to confirm
              </Label>
              <Input
                id="delete-tool-confirm"
                value={confirmId}
                onChange={(event) => setConfirmId(event.target.value)}
                placeholder={trimmedTool || "tool id"}
                autoComplete="off"
              />
            </div>

            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              <Eraser className="h-4 w-4" />
              {saving ? "Deleting…" : "Run delete funnel"}
            </Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
