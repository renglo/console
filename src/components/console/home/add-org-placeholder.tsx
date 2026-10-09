import { Plus } from 'lucide-react';

type AddOrgPlaceholderProps = {
  onClick: () => void;
};

export default function AddOrgPlaceholder({ onClick }: AddOrgPlaceholderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/35 bg-transparent text-muted-foreground transition hover:border-muted-foreground/55 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="size-10 stroke-[1.25] text-muted-foreground" aria-hidden />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        add new
      </span>
    </button>
  );
}
