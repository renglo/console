import { FormEvent, useEffect, useState } from 'react';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';

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
import { useToast } from '@/components/ui/use-toast';

import {
  normalizePreferenceKey,
  preferencesToRows,
  rowsToPreferences,
  type PreferenceRow,
} from '@/lib/entity-preferences';

interface DialogPreferencesProps {
  getUrl: string;
  putUrl: string;
  refreshUp?: () => void;
  title?: string;
  description?: string;
}

export default function DialogPreferences({
  getUrl,
  putUrl,
  refreshUp,
  title = 'Preferences',
  description = 'A preference is something you want, such as language, time_zone, or default_extension. The product uses it when it can.',
}: DialogPreferencesProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PreferenceRow[]>([
    { id: crypto.randomUUID(), key: '', value: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;

    const loadPreferences = async () => {
      setLoading(true);
      try {
        const response = await fetch(getUrl, {
          headers: {
            Authorization: `Bearer ${sessionStorage.accessToken}`,
          },
        });
        if (!response.ok) {
          throw new Error('Could not load preferences');
        }
        const document = await response.json();
        setRows(preferencesToRows(document?.preferences));
      } catch (error) {
        console.error(error);
        toast({
          title: 'Could not load preferences',
          variant: 'destructive',
        });
        setRows([{ id: crypto.randomUUID(), key: '', value: '' }]);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [open, getUrl, toast]);

  const addRow = () => {
    setRows((current) => [...current, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const removeRow = (id: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length > 0 ? next : [{ id: crypto.randomUUID(), key: '', value: '' }];
    });
  };

  const updateRow = (id: string, field: 'key' | 'value', value: string) => {
    const nextValue = field === 'key' ? normalizePreferenceKey(value) : value;
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: nextValue } : row)),
    );
  };

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionStorage.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences: rowsToPreferences(rows) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Could not save preferences');
      }
      toast({ title: 'Preferences saved' });
      refreshUp?.();
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Edit preferences"
          title="Preferences"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-3 border-b bg-muted/60 px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-4 px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="grid gap-3">
              {rows.map((row, index) => (
                <li key={row.id} className="grid gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Preference {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove preference"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${row.id}-name`}>Name</Label>
                    <Input
                      id={`${row.id}-name`}
                      value={row.key}
                      onChange={(e) => updateRow(row.id, 'key', e.target.value)}
                      placeholder="language"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${row.id}-value`}>Preferred value</Label>
                    <Input
                      id={`${row.id}-value`}
                      value={row.value}
                      onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                      placeholder="en"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={addRow}
            disabled={loading}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add a preference
          </Button>
          <Button type="submit" disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save preferences'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
