import { useContext, useState } from 'react';

import { GlobalContext } from '@/components/console/global-context';

import AddOrgPlaceholder from './add-org-placeholder';
import { projectCount } from './home-model';
import OrgCard from './org-card';
import OrgProjectDialog, { type OrgProjectDialogMode } from './org-project-dialog';
import type { HomePortfolio } from './types';

type PortfolioSectionProps = {
  portfolio: HomePortfolio;
};

export default function PortfolioSection({ portfolio }: PortfolioSectionProps) {
  const context = useContext(GlobalContext);
  const loadTree = context?.loadTree;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<OrgProjectDialogMode>('create');
  const [editOrgId, setEditOrgId] = useState<string | undefined>();

  const openCreate = () => {
    setDialogMode('create');
    setEditOrgId(undefined);
    setDialogOpen(true);
  };

  const openEdit = (orgId: string) => {
    setDialogMode('edit');
    setEditOrgId(orgId);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    loadTree?.();
  };
  const headingId = `portfolio-${portfolio.id}-heading`;

  return (
    <section aria-labelledby={headingId} className="border-b border-border/70 py-9 first:pt-2">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Portfolio
          </p>
          <h2 id={headingId} className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
            {portfolio.name}
          </h2>
          {portfolio.about ? (
            <p className="mt-1 text-sm text-muted-foreground">{portfolio.about}</p>
          ) : null}
        </div>
        <span className="hidden rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block">
          {projectCount(portfolio.orgs.length)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {portfolio.orgs.map((org) => (
          <OrgCard
            key={org.orgId}
            portfolioId={portfolio.id}
            org={org}
            onEdit={org.isScope ? undefined : () => openEdit(org.orgId)}
          />
        ))}
        <AddOrgPlaceholder onClick={openCreate} />
      </div>
      <OrgProjectDialog
        portfolioId={portfolio.id}
        mode={dialogMode}
        orgId={editOrgId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </section>
  );
}
