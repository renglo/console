import { useContext, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Search } from 'lucide-react';

import { GlobalContext } from '@/components/console/global-context';

import { homePortfoliosFromTree, projectCount, type AuthTreePortfolios } from './home-model';
import PortfolioSection from './portfolio-section';

const ALL_PORTFOLIOS = 'all';

export default function HomePage() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('No GlobalProvider');
  }
  const { tree } = context as unknown as {
    tree: { portfolios?: AuthTreePortfolios; preferences?: Record<string, string> };
  };

  const [activeId, setActiveId] = useState(ALL_PORTFOLIOS);
  const [query, setQuery] = useState('');

  const portfolios = useMemo(
    () => homePortfoliosFromTree(tree?.portfolios, tree?.preferences),
    [tree],
  );

  const totalProjects = portfolios.reduce((sum, portfolio) => sum + portfolio.orgs.length, 0);

  const visiblePortfolios = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return portfolios
      .filter((portfolio) => activeId === ALL_PORTFOLIOS || portfolio.id === activeId)
      .map((portfolio) => ({
        ...portfolio,
        orgs: portfolio.orgs.filter((org) => {
          if (!needle) return true;
          return (
            org.name.toLowerCase().includes(needle) ||
            org.handle.toLowerCase().includes(needle) ||
            org.tags.some(
              (tag) =>
                tag.key.toLowerCase().includes(needle) || tag.value.toLowerCase().includes(needle),
            )
          );
        }),
      }))
      .filter((portfolio) => portfolio.orgs.length > 0);
  }, [activeId, portfolios, query]);

  if (!tree?.portfolios) {
    return (
      <div className="px-8 py-10 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-10 sm:px-8">
        <span>
          Go to account settings to install apps in your environment.{' '}
          <NavLink to="/account" className="underline">
            Click here
          </NavLink>
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-8 lg:px-10">
        <header className="mb-3 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <label className="flex h-11 flex-1 items-center gap-3 rounded-full border border-border bg-muted/50 px-4 text-muted-foreground transition focus-within:border-foreground/30 focus-within:bg-background">
              <Search aria-hidden="true" className="size-4" />
              <span className="sr-only">Search entities</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search entities..."
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {projectCount(totalProjects)}
            </span>
          </div>
          <nav
            aria-label="Portfolios"
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <FilterPill
              label="All"
              pressed={activeId === ALL_PORTFOLIOS}
              onClick={() => setActiveId(ALL_PORTFOLIOS)}
            />
            {portfolios.map((portfolio) => (
              <FilterPill
                key={portfolio.id}
                label={portfolio.name}
                pressed={activeId === portfolio.id}
                onClick={() => setActiveId(portfolio.id)}
              />
            ))}
          </nav>
        </header>
        <div>
          {visiblePortfolios.map((portfolio) => (
            <PortfolioSection key={portfolio.id} portfolio={portfolio} />
          ))}
        </div>
        {visiblePortfolios.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-base font-semibold">No entities found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another name.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterPill({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
        pressed
          ? 'bg-foreground text-background'
          : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
