import { Outlet, Link } from 'react-router-dom';

import { useContext, useState } from 'react';
import { GlobalContext } from '@/components/console/global-context';
import { useLocation } from 'react-router-dom';
import DialogPut from '@/components/console/dialog-put';
import DialogTags from '@/components/console/dialog-tags';
import DialogPreferences from '@/components/console/dialog-preferences';

export default function AppSettings() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('No GlobalProvider');
  }
  const { tree } = context;

  const location = useLocation();
  const p_portfolio = location.pathname.split('/')[1];
  const p_setting = location.pathname.split('/')[3];
  const portfolio = tree?.portfolios?.[p_portfolio];
  const portfolioApi = `${import.meta.env.VITE_API_URL}/_auth/portfolios/${p_portfolio}`;

  const [refresh, setRefresh] = useState(false);

  const refreshAction = () => {
    setRefresh((prev) => !prev);
    console.log(refresh);
  };

  return (
    <div className="flex min-h-screen w-full flex-col" key={location.pathname}>
      <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-semibold">
            <span className="shrink-0">
              Settings for {portfolio?.name ?? '…'}
            </span>
            {portfolio && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5"
                role="toolbar"
                aria-label="Portfolio actions"
              >
                <DialogPut
                  selectedKey="name"
                  selectedValue={portfolio.name}
                  refreshUp={refreshAction}
                  title="Edit Portfolio"
                  instructions="Modify the Portfolio name and click save."
                  path={portfolioApi}
                  method="PUT"
                />
                <DialogTags
                  getUrl={portfolioApi}
                  putUrl={portfolioApi}
                  refreshUp={refreshAction}
                  title="Portfolio tags"
                />
                <DialogPreferences
                  getUrl={portfolioApi}
                  putUrl={portfolioApi}
                  refreshUp={refreshAction}
                  title="Portfolio preferences"
                />
              </span>
            )}
          </div>
          <span className="text-3xl font-semibold"></span>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav
            className="grid gap-4 text-sm text-muted-foreground"
            x-chunk="dashboard-04-chunk-0"
          >
            <Link
              to={`/${p_portfolio}/settings/orgs`}
              className={
                p_setting === 'orgs' ? 'font-semibold text-primary' : ''
              }
            >
              Entities
            </Link>
            <Link
              to={`/${p_portfolio}/settings/teams`}
              className={
                p_setting === 'teams' ? 'font-semibold text-primary' : ''
              }
            >
              Teams
            </Link>
            <Link
              to={`/${p_portfolio}/settings/extensions`}
              className={
                p_setting === 'extensions' || p_setting === 'tools'
                  ? 'font-semibold text-primary'
                  : ''
              }
            >
              Extensions
            </Link>
          </nav>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
