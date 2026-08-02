type EntityTags = Record<string, string | string[]>;

function formatTagValues(value: string | string[]): string {
  const values = (Array.isArray(value) ? value : [value])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
  return values.join(', ');
}

interface EntityTagsListProps {
  tags?: EntityTags;
  className?: string;
}

export default function EntityTagsList({ tags, className }: EntityTagsListProps) {
  const entries = Object.entries(tags ?? {}).filter(([, value]) => formatTagValues(value));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <ul className="space-y-1">
        {entries.map(([key, value]) => (
          <li key={key} className="text-xs">
            <span className="font-medium text-foreground">{key}</span>
            <span className="text-muted-foreground">: {formatTagValues(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
