import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { useLocation } from 'react-router-dom';
import { useState, useContext } from 'react';
import { SquarePlus } from 'lucide-react';
import { GlobalContext } from "@/components/console/global-context"


import OrgsCard from "@/components/console/orgs-card"
import OrgProjectDialog from "@/components/console/home/org-project-dialog"
import { PORTFOLIO_SCOPE_ORG, sortByName } from "@/lib/sort-entities"
  
export default function SettingsOrgs() {

  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('No GlobalProvider');
  }
  const { tree, loadTree } = context;

  const location = useLocation();
  const p_portfolio = location.pathname.split('/')[1]
  
  const [createOpen, setCreateOpen] = useState(false);

  const refreshAction = () => {
    loadTree?.();
  };


  return (
          <div className="grid gap-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            <Card className="">
              <CardHeader>
                <CardTitle>Entities</CardTitle>
                <CardDescription>
                   Entities are stand-alone and belong to your portfolio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setCreateOpen(true)}
                >
                  <SquarePlus className="size-5" aria-hidden />
                  Create a new organization
                </button>
                <OrgProjectDialog
                  portfolioId={p_portfolio}
                  mode="create"
                  open={createOpen}
                  onOpenChange={setCreateOpen}
                  onSaved={refreshAction}
                />
              </CardContent>  
            </Card>
            <div className="grid gap-4 grid-cols-2">
            {
              (() => {
                const orgs = sortByName(Object.values(tree?.portfolios[p_portfolio]?.orgs || {}))
                  .filter((row) => row['org_id'] !== PORTFOLIO_SCOPE_ORG);
                return orgs.length > 0 ? (
                  orgs.map((row) => (
                    <OrgsCard
                      key={row['org_id']}
                      orgdoc={row}
                      teamsdict={tree?.portfolios[p_portfolio]?.teams}
                      portfolioid={p_portfolio}
                    />
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No Orgs</div>
                );
              })()
            }
            </div>  
          </div>
  )
}
