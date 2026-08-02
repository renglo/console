import { FormEvent, useEffect, useState } from 'react';
import { Plus, Tags, Trash2 } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

type TagRow = {
  id: string;
  key: string;
  value: string;
};

interface DialogTagsProps {
  getUrl: string;
  putUrl: string;
  refreshUp?: () => void;
  title?: string;
}

type EntityTags = Record<string, string | string[]>;

function normalizeTagKey(key: string): string {
  return key.trim().toLowerCase();
}

function tagsToRows(tags: EntityTags | undefined): TagRow[] {
  const rows: TagRow[] = [];
  for (const [key, value] of Object.entries(tags ?? {})) {
    const values = Array.isArray(value) ? value : [String(value ?? '')];
    for (const entry of values) {
      const trimmed = String(entry ?? '').trim();
      if (!trimmed) continue;
      rows.push({
        id: crypto.randomUUID(),
        key: normalizeTagKey(key),
        value: trimmed,
      });
    }
  }
  if (rows.length === 0) {
    return [{ id: crypto.randomUUID(), key: '', value: '' }];
  }
  return rows;
}

function rowsToTags(rows: TagRow[]): Record<string, string[]> {
  const tags: Record<string, string[]> = {};
  for (const row of rows) {
    const key = normalizeTagKey(row.key);
    const value = row.value.trim();
    if (!key || !value) continue;
    if (!tags[key]) {
      tags[key] = [];
    }
    if (!tags[key].includes(value)) {
      tags[key].push(value);
    }
  }
  return tags;
}

export default function DialogTags({
  getUrl,
  putUrl,
  refreshUp,
  title = 'Tags',
}: DialogTagsProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TagRow[]>([{ id: crypto.randomUUID(), key: '', value: '' }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;

    const loadTags = async () => {
      setLoading(true);
      try {
        const response = await fetch(getUrl, {
          headers: {
            Authorization: `Bearer ${sessionStorage.accessToken}`,
          },
        });
        if (!response.ok) {
          throw new Error('Could not load tags');
        }
        const document = await response.json();
        setRows(tagsToRows(document?.tags));
      } catch (error) {
        console.error(error);
        toast({
          title: 'Could not load tags',
          variant: 'destructive',
        });
        setRows([{ id: crypto.randomUUID(), key: '', value: '' }]);
      } finally {
        setLoading(false);
      }
    };

    loadTags();
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
    const nextValue = field === 'key' ? normalizeTagKey(value) : value;
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
        body: JSON.stringify({ tags: rowsToTags(rows) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Could not save tags');
      }
      toast({ title: 'Tags saved' });
      refreshUp?.();
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save tags',
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
          aria-label="Edit tags"
        >
          <Tags className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Add tags as key-value rows. Use the same key more than once to store
            multiple values (for example, two locations for one organization).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input
                        value={row.key}
                        onChange={(e) => updateRow(row.id, 'key', e.target.value)}
                        placeholder="year"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.value}
                        onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                        placeholder="2013"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        aria-label="Remove tag"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={loading}>
              <Plus className="mr-1 h-4 w-4" />
              Add tag
            </Button>
            <Button type="submit" disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save tags'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
