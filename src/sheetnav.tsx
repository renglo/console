import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { WindowSizeProvider } from '@/contexts/WindowSizeContext';
import { useContext } from 'react';
import { GlobalContext } from "@/components/console/global-context";
import { lazyExtensionUi, resolveToolHandle } from "@/lib/extension-ui";

const importToolSheetNav = (tool: string) => lazyExtensionUi("sheetnav", tool);

interface SheetNavProps {
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

export default function SheetNav({portfolio, org, tool, section}: SheetNavProps) {   
    
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