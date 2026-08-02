import { memo } from 'react';

import {
  Avatarsq,
  AvatarsqFallback,
  AvatarsqImage,
} from '@/components/ui/avatarsq';
import { cn } from '@/lib/utils';
import {
  activePortfolioOrgs,
  orgThumbnailUrl,
  type PortfolioOrgRef,
} from '@/lib/image-upload';

interface PortfolioThumbnailProps {
  portfolioId: string;
  portfolioName?: string;
  orgs?: Record<string, PortfolioOrgRef>;
  className?: string;
}

/**
 * Portfolio avatar built from org thumbnails (same URLs as /home).
 * Uses plain <img> tags in a CSS grid — no canvas — so the browser can
 * reuse images already fetched on the home page.
 */
function PortfolioThumbnail({
  portfolioId,
  portfolioName = '',
  orgs,
  className,
}: PortfolioThumbnailProps) {
  const activeOrgs = activePortfolioOrgs(orgs).slice(0, 4);
  const fallbackLabel = (portfolioName || portfolioId).substring(0, 2).toUpperCase();

  if (activeOrgs.length === 0) {
    return (
      <Avatarsq className={cn('h-10 w-10', className)}>
        <AvatarsqFallback>{fallbackLabel}</AvatarsqFallback>
      </Avatarsq>
    );
  }

  if (activeOrgs.length === 1) {
    const org = activeOrgs[0];
    return (
      <Avatarsq className={cn('h-10 w-10', className)}>
        <AvatarsqImage src={orgThumbnailUrl(portfolioId, org.org_id)} alt="" />
        <AvatarsqFallback>{org.handle?.substring(0, 2) ?? fallbackLabel}</AvatarsqFallback>
      </Avatarsq>
    );
  }

  const gridClass =
    activeOrgs.length === 2
      ? 'grid-cols-2 grid-rows-1'
      : 'grid-cols-2 grid-rows-2';

  return (
    <div
      className={cn(
        'grid h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted',
        gridClass,
        className,
      )}
      aria-hidden
    >
      {activeOrgs.map((org) => (
        <img
          key={org.org_id}
          src={orgThumbnailUrl(portfolioId, org.org_id)}
          alt=""
          decoding="async"
          className="h-full w-full object-cover"
        />
      ))}
    </div>
  );
}

export default memo(PortfolioThumbnail);
