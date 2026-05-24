import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { WindowSizeProvider } from '@/contexts/WindowSizeContext';
import { useContext } from 'react';
import { GlobalContext } from "@/components/console/global-context";


const importToolSheetNav = (tool: string) => {
    return lazy(() => 
        import(`@extensions/${tool}/ui/navigation/${tool}_sheetnav.tsx`)
            .catch(() => {
                // Return a simple component if import fails
                return {
                    default: () => null
                };
            })
    );
};

interface SheetNavProps {
    portfolio: string;
    org: string;
    tool: string;
    section: string;
}

interface Portfolio {
    tools: Record<string, Tool>;
}

interface Tool {
    handle: string;
}

export default function SheetNav({portfolio, org, tool, section}: SheetNavProps) {   
    
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
    const ToolSheetNavComponent = importToolSheetNav(toolHandle);
       
    return (
        <div className="contents">
            <Suspense fallback={<div></div>}>
                <WindowSizeProvider>
                    <ToolSheetNavComponent 
                        portfolio={portfolio} 
                        org={org} 
                        tool={tool} 
                        section={section} 
                        onNavigate={handleNavigation}
                    />
                </WindowSizeProvider>
            </Suspense>
        </div>
    );
}