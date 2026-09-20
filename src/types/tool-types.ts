/**
 * Type definitions for Console Tool Components
 * 
 * These types define the standard interfaces that all tool components should implement.
 * Use these when developing tool packages to ensure compatibility with console.
 */

/**
 * Main tool component props
 * This is the primary interface for the main tool component (e.g., my-tool.tsx)
 */
export interface ToolComponentProps {
  /** Portfolio identifier */
  portfolio: string;
  
  /** Organization identifier */
  org: string;
  
  /** Tool identifier (mapped from handle) */
  tool: string;
  
  /** Current section/page within the tool */
  section?: string;
  
  /** The complete application tree containing portfolios, orgs, and tools */
  tree: TreeData;
  
  /** Query parameters from URL */
  query: Record<string, string>;
  
  /** Navigation callback function */
  onNavigate: (path: string) => void;
  
  /** Additional path parameters */
  p1?: string;
  p2?: string;
  p3?: string;
}

/**
 * Navigation component props (side nav and sheet nav)
 */
export interface ToolNavigationProps {
  /** Portfolio identifier */
  portfolio: string;
  
  /** Organization identifier */
  org: string;
  
  /** Tool handle/name */
  tool: string;
  
  /** Current section/page */
  section?: string;
  
  /** Navigation callback function */
  onNavigate: (path: string) => void;
}

/**
 * Onboarding component props
 */
export interface ToolOnboardingProps {
  /** The complete application tree */
  tree: TreeData;
}

/**
 * Application tree structure
 */
export interface TreeData {
  portfolios: Record<string, Portfolio>;
}

/**
 * Portfolio structure
 */
export interface Portfolio {
  name: string;
  portfolio_id: string;
  orgs: Record<string, Organization>;
  tools: Record<string, Tool>;
  extensions?: Record<string, Tool>;
}

/**
 * Organization structure
 */
export interface Organization {
  name: string;
  org_id: string;
  tools: string[]; // Array of legacy tool IDs
  extensions?: string[];
}

/**
 * Tool metadata
 */
export interface Tool {
  name: string;
  handle: string; // URL-friendly identifier
}

/**
 * Standard component exports
 * Each tool package should export these components as default exports
 */

/**
 * Main tool component
 * Export path: ui/{tool-name}.tsx
 */
export type ToolMainComponent = React.ComponentType<ToolComponentProps>;

/**
 * Side navigation component
 * Export path: ui/navigation/{tool-name}_sidenav.tsx
 */
export type ToolSideNavComponent = React.ComponentType<ToolNavigationProps>;

/**
 * Sheet navigation component
 * Export path: ui/navigation/{tool-name}_sheetnav.tsx
 */
export type ToolSheetNavComponent = React.ComponentType<ToolNavigationProps>;

/**
 * Onboarding component
 * Export path: ui/onboarding/{tool-name}_onboarding.tsx
 */
export type ToolOnboardingComponent = React.ComponentType<ToolOnboardingProps>;

/**
 * Helper type for navigation paths
 */
export type NavigationPath = `/${string}/${string}/${string}` | `/${string}/${string}/${string}/${string}`;

/**
 * Navigation helper function type
 */
export type NavigateFunction = (path: NavigationPath | string) => void;

/**
 * Example usage in a tool component:
 * 
 * ```typescript
 * import { ToolComponentProps } from '@console-plugins/types';
 * 
 * export default function MyTool({
 *   portfolio,
 *   org,
 *   tool,
 *   section,
 *   tree,
 *   query,
 *   onNavigate
 * }: ToolComponentProps) {
 *   // Your component implementation
 * }
 * ```
 */

