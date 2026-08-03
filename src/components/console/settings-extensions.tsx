import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  RefreshCcw,
} from "lucide-react"

import { useParams,useLocation } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { GlobalContext } from "@/components/console/global-context"

import ExtensionsCard from "@/components/console/extensions-card"
import { sortByName } from "@/lib/sort-entities"

interface Tool {
  tool_id: string;
  name: string;
  handle: string;
  roles?: string[];
}

interface Portfolio {
  name: string;
  portfolio_id: string;
  orgs: Record<string, Org>;
  teams: Record<string, Team>;
  tools: Record<string, Tool>;
}

interface Org {
  name: string;
  org_id: string;
  active: boolean;
}

interface Team {
  name: string;
  team_id: string;
}
  
export default function SettingsExtensions() {

  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('No GlobalProvider');
  }
  const { tree } = context as unknown as { tree: { portfolios: Record<string, Portfolio> } };
  console.log(tree);


  const location = useLocation();
  const p_portfolio = location.pathname.split('/')[1]
  //const p_setting = location.pathname.split('/')[3]


  const [refresh, setRefresh] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const { ring } = useParams(); // Extract the 'route' parameter from the URL



  useEffect(() => {
      // Function to fetch Blueprint
      const fetchBlueprint = async () => {
        try {
          // Fetch Blueprint
          const blueprintResponse = await fetch(`${import.meta.env.VITE_API_URL}/_blueprint/sys/entities/last`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
            },
          });
          const blueprintData = await blueprintResponse.json();
          console.log(blueprintData);
          setRefresh((prev: boolean) => !prev); 
          console.log(refresh)

          

        } catch (err) {
          if (err instanceof Error) {
            setError(err);  // Now TypeScript knows `err` is of type `Error`.
          } else {
            setError(new Error("An unknown error occurred"));  // Handle other types
          }
          console.log(error)
        } finally {
          //setLoading(false);
        }
      };

      fetchBlueprint();
  }, [ring]);


  const refreshTree = async () => {
    try {
      // Fetch Blueprint
      await fetch(`${import.meta.env.VITE_API_URL}/_auth/tree/refresh`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionStorage.accessToken}`,
        },
      });
  
    } catch (err) { 
      console.log(err); // Log the error directly
    }
  };

  return (
          <div className="grid gap-6 overflow-y-auto max-h-[calc(100vh-180px)]">
            <Card className="">
              <CardHeader>
                <CardTitle>Extensions</CardTitle>
                <CardDescription>
                List of active extensions in this portfolio:
              </CardDescription>
              </CardHeader> 
            </Card>
            <div className="grid gap-4 grid-cols-1">
            {
              (tree?.portfolios[p_portfolio]?.tools && Object.keys(tree?.portfolios[p_portfolio]?.tools).length > 0) ? (
                sortByName(Object.values(tree?.portfolios[p_portfolio]?.tools as Record<string, Tool>)).map((row: Tool) => (
                  <ExtensionsCard
                    key={row.tool_id}
                    extensiondoc={row}
                    teamsdict={tree?.portfolios[p_portfolio]?.teams}
                    orgsdict={tree?.portfolios[p_portfolio]?.orgs}
                    portfolioid={p_portfolio}
                  />
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No Extensions</div>
              )
            }
            </div>
            <button onClick={refreshTree} className="flex items-center">
                      <RefreshCcw className="h-5 w-5" />
            </button>
          </div>
          
  )
}
