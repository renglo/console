import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';

import ExtensionShortcut from './extension-shortcut';
import type { HomeOrg } from './types';

type OrgCardProps = {
  portfolioId: string;
  org: HomeOrg;
  onEdit?: () => void;
};

export default function OrgCard({ portfolioId, org, onEdit }: OrgCardProps) {
  const [failed, setFailed] = useState(false);
  const initials = (org.handle || org.name).substring(0, 3);

  const thumbnailInner = (
    <>
      {failed ? (
        <div className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">
          {initials}
        </div>
      ) : (
        <img
          src={org.imageSrc}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
          className={
            org.isScope
              ? 'size-full object-contain p-12'
              : 'size-full object-cover transition duration-500 group-hover/thumb:scale-105'
          }
        />
      )}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2.5 pb-2.5 text-white ${
          org.tags.length > 0 ? 'pt-16' : 'pt-12'
        }`}
      >
        <p className="line-clamp-2 text-sm font-semibold leading-tight tracking-tight">{org.name}</p>
        {org.tags.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {org.tags.map((tag, index) => (
              <li
                key={`${tag.key}-${index}-${tag.value}`}
                className="max-w-full truncate rounded-[2px] border border-white/80 bg-black/30 px-1 py-px text-[10px] font-medium leading-tight"
              >
                {tag.value}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <article className="group min-w-0 overflow-visible">
      <div className="group/thumb relative aspect-square w-full overflow-hidden bg-muted ring-1 ring-black/5">
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 z-20 h-8 w-8 rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-background hover:text-foreground group-hover/thumb:opacity-100 focus-visible:opacity-100"
            aria-label={`Edit ${org.name}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {org.thumbnailTarget ? (
          <NavLink
            to={org.thumbnailTarget}
            className="relative block size-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Open ${org.name}`}
          >
            {thumbnailInner}
          </NavLink>
        ) : (
          <div className="relative block size-full" aria-label={org.name}>
            {thumbnailInner}
          </div>
        )}
      </div>
      <div className="relative flex justify-start gap-1 overflow-x-auto overflow-y-visible pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {org.extensions.length > 0 ? (
          org.extensions.map((extension) => (
            <ExtensionShortcut
              key={extension.id}
              portfolioId={portfolioId}
              orgId={org.orgId}
              extension={extension}
            />
          ))
        ) : (
          <div className="text-xs text-muted-foreground">No tools available</div>
        )}
      </div>
    </article>
  );
}
