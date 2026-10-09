import { Plus, Trash2 } from 'lucide-react';

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
import { normalizeTagKey, type TagRow } from '@/lib/entity-tags';

type TagRowsEditorProps = {
  rows: TagRow[];
  onChange: (rows: TagRow[]) => void;
  disabled?: boolean;
};

export default function TagRowsEditor({ rows, onChange, disabled }: TagRowsEditorProps) {
  const addRow = () => {
    onChange([...rows, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const removeRow = (id: string) => {
    const next = rows.filter((row) => row.id !== id);
    onChange(next.length > 0 ? next : [{ id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const updateRow = (id: string, field: 'key' | 'value', value: string) => {
    const nextValue = field === 'key' ? normalizeTagKey(value) : value;
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: nextValue } : row)));
  };

  return (
    <div className="grid gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Input
                  value={row.key}
                  onChange={(e) => updateRow(row.id, 'key', e.target.value)}
                  placeholder="year"
                  disabled={disabled}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={row.value}
                  onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                  placeholder="2013"
                  disabled={disabled}
                />
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={disabled}
                  aria-label="Remove tag"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
        <Plus className="mr-1 h-4 w-4" />
        Add tag
      </Button>
    </div>
  );
}
