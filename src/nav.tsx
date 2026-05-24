import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { GlobalContext } from "@/components/console/global-context";

const importNav = (tool: string) => {
    // Use relative path from the current directory
    return lazy(() => 
      import(`@extensions/${tool}/ui/navigation/${tool}_sidenav.tsx`)
          .catch((error) => {
              console.log(`${tool} :E `, error);
              // Return a simple component if import fails
              return {
                  default: () => null
              };
          })
      );
};

interface SideNavProps {
    portfolio: string;
    org: string;
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
    
    if (!context || !tool) {
        return null;
    }

    const { tree } = context as unknown as { tree: { portfolios: Record<string, Portfolio> } };
    const portfolioTools = tree?.portfolios?.[portfolio]?.tools || {};
    const toolHandle = portfolioTools[tool]?.handle || tool;

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