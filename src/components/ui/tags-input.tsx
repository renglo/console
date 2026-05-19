import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function normalizeToken(token: string): string {
  return token.trim();
}

function uniqueNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const token = normalizeToken(raw);
    if (!token) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

export default function TagsInput({
  value,
  onChange,
  placeholder,
  disabled = false,
}: TagsInputProps) {
  const [draft, setDraft] = useState("");
  const tags = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const commitDraft = (source: string) => {
    const parts = source
      .split(/[\n,]/g)
      .map((part) => normalizeToken(part))
      .filter(Boolean);
    if (!parts.length) return;
    onChange(uniqueNonEmpty([...tags, ...parts]));
  };

  const removeTag = (idx: number) => {
    const next = tags.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border px-2 py-2">
        {tags.map((tag, idx) => (
          <Badge key={`${tag}-${idx}`} variant="secondary" className="gap-1 pr-1">
            <span>{tag}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              disabled={disabled}
              onClick={() => removeTag(idx)}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        <Input
          disabled={disabled}
          className="h-8 min-w-[10rem] flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
          placeholder={placeholder ?? "Type and press Enter"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!draft.trim()) return;
            commitDraft(draft);
            setDraft("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
              e.preventDefault();
              if (!draft.trim()) return;
              commitDraft(draft);
              setDraft("");
              return;
            }
            if (e.key === "Backspace" && !draft && tags.length > 0) {
              e.preventDefault();
              removeTag(tags.length - 1);
            }
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Press Enter, Tab, or comma to add tags.
      </p>
    </div>
  );
}
