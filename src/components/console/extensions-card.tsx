import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DialogSwitch from "@/components/console/dialog-switch";
import DialogPut from "@/components/console/dialog-put";
import DialogDelete from "@/components/console/dialog-delete";
import DialogTags from "@/components/console/dialog-tags";
import TeamToolRoles from "@/components/console/team-tool-roles";
import { useState } from "react";

interface ExtensionsCardProps {
  extensiondoc: any;
  teamsdict: any;
  orgsdict: any;
  portfolioid: string;
}

interface ToolOrgAccess {
  orgs: string[];
  roles: string[];
}

interface TeamToolsAccess {
  [key: string]: ToolOrgAccess;
}

interface Team {
  name: string;
  team_id: string;
  tools: TeamToolsAccess;
  tools_access: string[];
}

interface Org {
  handle: string;
  name: string;
  org_id: string;
}

export default function ExtensionsCard({
  extensiondoc,
  teamsdict,
  orgsdict,
  portfolioid,
}: ExtensionsCardProps) {
  const [refresh, setRefresh] = useState(false);

  const refreshAction = () => {
    setRefresh((prev) => !prev);
    console.log(refresh);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>
          @{extensiondoc.handle} id:{extensiondoc.tool_id}
        </CardDescription>
        <CardTitle className="group text-lg">
          <span className="flex items-center gap-2">
            <Badge variant="tool">Extension</Badge>
            {extensiondoc.name}
            <span className={teamsdict ? "flex items-center gap-2" : "hidden"}>
              <DialogPut
                selectedKey="name"
                selectedValue={extensiondoc.name}
                refreshUp={refreshAction}
                title="Edit attribute"
                instructions="Modify the attribute and click save."
                path={`${import.meta.env.VITE_API_URL}/_auth/portfolios/${portfolioid}/tools/${extensiondoc.tool_id}`}
                method="PUT"
              />
              <DialogTags
                getUrl={`${import.meta.env.VITE_API_URL}/_auth/portfolios/${portfolioid}/tools/${extensiondoc.tool_id}`}
                putUrl={`${import.meta.env.VITE_API_URL}/_auth/portfolios/${portfolioid}/tools/${extensiondoc.tool_id}`}
                refreshUp={refreshAction}
                title="Extension tags"
              />
              <DialogDelete
                selectedKey="name"
                selectedValue={extensiondoc.name}
                refreshUp={refreshAction}
                title="Delete entity"
                instructions={`Are you sure you want to delete this extension?
                                All its assets (data, models, history) will be permanently deleted.`}
                path={`${import.meta.env.VITE_API_URL}/_auth/portfolios/${portfolioid}/tools/${extensiondoc.tool_id}`}
                method="DELETE"
              />
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">
          {extensiondoc.about} {extensiondoc.location}
        </div>
      </CardContent>
      <CardFooter className={teamsdict ? "" : "hidden"}>
        <div className="flex flex-col gap-2">
          <div className="border-t px-6 py-6 text-sm">
            <Badge variant="team">Teams</Badge> that have access to this extension{" "}
            <span className="font-semibold">({extensiondoc.name})</span>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="border border-gray-300 p-2 text-left">TEAMS</th>
                <th className="min-w-[9rem] border border-gray-300 p-2 text-left">
                  <span className="text-xxs">ROLES</span>
                </th>
                {orgsdict && Object.keys(orgsdict).length ? (
                  Object.entries(orgsdict).map(([orgId, org]) => (
                    <th key={orgId} className="border border-gray-300 p-2 text-left">
                      <div className="flex flex-col items-center">
                        <span className="w-14 break-words text-xxs">{(org as Org).name}</span>
                      </div>
                    </th>
                  ))
                ) : (
                  <th className="border border-gray-300 p-2 text-left text-xxs text-muted-foreground">
                    No orgs
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {teamsdict && Object.keys(teamsdict).length > 0 ? (
                (Object.values(teamsdict) as Team[]).map((row: Team) => (
                  <tr key={row.team_id}>
                    <td className="border border-gray-300 p-2 text-left align-middle">
                      {row.name}
                    </td>
                    <td className="border border-gray-300 p-2 text-left align-middle">
                      <TeamToolRoles
                        teamId={row.team_id}
                        teamName={row.name}
                        toolId={extensiondoc.tool_id}
                        toolName={extensiondoc.name}
                        availableRoles={extensiondoc.roles || []}
                        assignedRoles={row?.tools?.[extensiondoc.tool_id]?.roles || []}
                        refreshUp={refreshAction}
                      />
                    </td>

                    {orgsdict && Object.keys(orgsdict).length ? (
                      Object.entries(orgsdict).map(([orgId, org]) =>
                        row?.tools?.[extensiondoc.tool_id]?.orgs?.includes(orgId) ? (
                          <td key={orgId} className="border border-gray-300 p-2 text-left align-middle">
                            <DialogSwitch
                              refreshUp={refreshAction}
                              title="Please confirm:"
                              instructions={`Do you want to remove access to team (${row.name})
                                                            from extension ${extensiondoc.name}
                                                            in ${(org as Org).name}?`}
                              path={`${import.meta.env.VITE_API_URL}/_auth/teams/${row.team_id}/tools/${extensiondoc.tool_id}/orgs/${orgId}`}
                              method="DELETE"
                              label=""
                            />
                          </td>
                        ) : (
                          <td key={orgId} className="border border-gray-300 p-2 text-left align-middle">
                            <DialogSwitch
                              refreshUp={refreshAction}
                              title="Please confirm:"
                              instructions={`Do you want to add access to team (${row.name})
                                                            from extension ${extensiondoc.name}
                                                            in ${(org as Org).name}?`}
                              path={`${import.meta.env.VITE_API_URL}/_auth/teams/${row.team_id}/tools/${extensiondoc.tool_id}/orgs/${orgId}`}
                              method="POST"
                              label=""
                            />
                          </td>
                        )
                      )
                    ) : (
                      <td className="border border-gray-300 p-2 text-left align-middle text-xxs text-muted-foreground">
                        No orgs available (create at least one)
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td>
                    <div></div>
                  </td>
                  <td>Org 1c</td>
                  <td>Org 2c</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardFooter>
    </Card>
  );
}
