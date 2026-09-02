import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { GlobalContext } from "@/components/console/global-context";
import { lazyExtensionUi, resolveToolHandle } from "@/lib/extension-ui";

const importNav = (tool: string) => lazyExtensionUi("sidenav", tool);

interface SideNavProps {
    portfolio?: string;
    org?: string;
    tool?: string;
    section?: string;
}

interface Portfolio {
    tools: Record<string, Tool>;
}

interface Tool {
    handle: string;
}

export default function SideNav({portfolio, org, tool, section}: SideNavProps) {  
    
    const navigate = useNavigate();
    const context = useContext(GlobalContext);
    
    if (!context || !tool || tool === "undefined") {
        return null;
    }

    const { tree } = context as unknown as { tree: { portfolios: Record<string, Portfolio> } };
    const portfolioTools = (portfolio && tree?.portfolios?.[portfolio]?.tools) || {};
    const toolHandle = resolveToolHandle(portfolioTools, tool);
    if (!toolHandle) {
        return null;
    }

    const handleNavigation = (path: string) => {
        navigate(path);
      };

    // Dynamically load the tool component
    const ToolNavComponent = importNav(toolHandle);
       
    return (
        <Suspense fallback={<div></div>}>          
                <ToolNavComponent 
                    portfolio={portfolio} 
                    org={org}
                    tool={tool}
                    section={section}
                    onNavigate={handleNavigation}
                /> 
        </Suspense>
    );
}