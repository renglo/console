import { lazy, Suspense, useContext } from 'react';
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { GlobalContext } from "@/components/console/global-context";


interface Portfolio {
    name: string;
    portfolio_id: string;
    orgs: Record<string, Org>;
    tools: Record<string, Tool>;
  }
  
interface Org {
    name: string;
    org_id: string;
    tools: string[];
}

interface Tool {
    name: string;
    handle: string;
}




// Import extension UI components dynamically
const importTool = (tool: string) => {
    return lazy(() => 
        import(`@extensions/${tool}/ui/${tool}.tsx`)
            .catch(() => {
                // Return a simple component if import fails
                return {
                    default: () => null
                };
            })
    );
};

export default function ToolRouter() {

    const { portfolio, org, tool, section, p1, p2, p3} = useParams();
    const [searchParams] = useSearchParams();
    const queryParams = Object.fromEntries(searchParams?.entries() || []) || {};

    // Handle case when context might be undefined
    const context = useContext(GlobalContext);
    const navigate = useNavigate();

    if (!context) {
        throw new Error("No GlobalProvider");
    }
    const { tree } = context as unknown as { tree: { portfolios: Record<string, Portfolio> } };

    if (!portfolio || !org) {
        return null;
    }

    if (!tool) {
        return null;
    }

    const portfolioTools = tree.portfolios[portfolio]?.tools || {};
    const tool_id = portfolioTools[tool]
        ? tool
        : Object.entries(portfolioTools).find(([_, toolData]) => toolData.handle === tool)?.[0];
    const tool_handle = tool_id ? portfolioTools[tool_id]?.handle : undefined;

    console.log('Router : Portfolio/Org/Tool/Section/p1/p2/p3/Query',portfolio,org,tool_id,section,p1,p2,p3,queryParams);

    const handleNavigation = (path: string) => {
        navigate(path);
    };

    // Dynamically load the tool component
    if (!tool_id || !tool_handle) {
        return null;
    }

    const ToolComponent = importTool(tool_handle);
       
    return (
        <Suspense fallback={<div></div>}>
            <ToolComponent
                portfolio={portfolio}
                org={org}
                tool={tool_id}
                section={section}
                tree = {tree}
                query = {queryParams}
                onNavigate={handleNavigation}
                p1={p1}
                p2={p2}
                p3={p3}
             />
        </Suspense>
    );
}
