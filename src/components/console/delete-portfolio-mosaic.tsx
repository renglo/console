import { FormEvent, useContext, useEffect, useState } from "react";
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

export default function DeletePortfolioMosaic() {
  const { toast } = useToast();
  const context = useContext(GlobalContext);

  const [open, setOpen] = useState(false);
  const [portfolioId, setPortfolioId] = useState("");
  const [portfolioName, setPortfolioName] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setPortfolioId("");
      setPortfolioName("");
      setConfirmId("");
      setSaving(false);
    }
  }, [open]);

  const trimmedId = portfolioId.trim();
  const trimmedName = portfolioName.trim();
  const canSubmit =
    Boolean(trimmedId) &&
    Boolean(trimmedName) &&
    confirmId.trim() === trimmedId &&
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

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    setSaving(true);
    try {
      const lookup = await fetch(
        `${import.meta.env.VITE_API_URL}/_auth/portfolios/${trimmedId}`,
        { method: "GET", headers },
      );
      const portfolio = await lookup.json();
      if (!lookup.ok) {
        toast({
          title: "Delete failed",
          description: portfolio?.message || "Portfolio not found.",
        });
        return;
      }

      const actualName = String(portfolio?.name ?? "").trim();
      if (!actualName || actualName !== trimmedName) {
        toast({
          title: "Delete failed",
          description: "That name does not match this portfolio.",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/_auth/portfolios/${trimmedId}`,
        {
          method: "DELETE",
          headers,
          body: JSON.stringify({ name: trimmedName }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        toast({
          title: "Delete failed",
          description: result?.message || "Could not delete the portfolio.",
        });
        return;
      }

      await fetch(`${import.meta.env.VITE_API_URL}/_auth/tree/refresh`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await context?.loadTree();

      toast({
        title: "Portfolio hidden",
        description: `${actualName} is marked deleted. Its data and relationships are kept.`,
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
          aria-label="Delete portfolio"
        >
          <Eraser className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete portfolio</DialogTitle>
          <DialogDescription>
            Type the portfolio id, its current name, and the id again. The name
            is not shown here. This hides the portfolio. Its data and
            relationships are kept.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="rounded-md border p-6">
          <form onSubmit={handleSubmit} className="grid gap-4" autoComplete="off">
            <div className="grid gap-2">
              <Label htmlFor="delete-portfolio-id">Portfolio id</Label>
              <Input
                id="delete-portfolio-id"
                value={portfolioId}
                onChange={(event) => setPortfolioId(event.target.value)}
                placeholder="8c38e9a6bd5d"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="delete-portfolio-name">Portfolio name</Label>
              <Input
                id="delete-portfolio-name"
                value={portfolioName}
                onChange={(event) => setPortfolioName(event.target.value)}
                placeholder="Type the portfolio name"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="delete-portfolio-confirm">
                Type the portfolio id again
              </Label>
              <Input
                id="delete-portfolio-confirm"
                value={confirmId}
                onChange={(event) => setConfirmId(event.target.value)}
                placeholder={trimmedId || "portfolio id"}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              <Eraser className="h-4 w-4" />
              {saving ? "Deleting…" : "Delete portfolio"}
            </Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
