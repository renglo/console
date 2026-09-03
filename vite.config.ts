import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { fileURLToPath } from 'url'
import { rengloExtensionResolver } from "./renglo-extension-resolver"
import { wlAliases } from "./wl.local"

// Try to load local extension aliases if the file exists
let extensionAliases = {};
try {
  extensionAliases = (await import("./extensions.local")).extensionAliases;
} catch {
  // no local extensions configured
}



export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const apiUrl = `${env.VITE_API_URL ?? ''}`;
  const isDevMode = mode === 'development' || env.VITE_DEV_MODE === 'true';

  return {
    base: '/',
    plugins: [rengloExtensionResolver(), react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        ...extensionAliases,
        ...wlAliases,
      },
      // Preserve symlinks for workspace packages
      preserveSymlinks: true,
      // Dedupe dependencies that are used by workspace packages
      dedupe: [
        'react',
        'react-dom',
        'react-day-picker',
        'date-fns',
        'lucide-react',
        // Extensions live outside console/, so node resolution from their files
        // never reaches console/node_modules — dedupe pins them to this root.
        'react-router-dom',
        'pdfjs-dist',
        '@radix-ui/react-accordion',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-avatar',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-context-menu',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-hover-card',
        '@radix-ui/react-label',
        '@radix-ui/react-menubar',
        '@radix-ui/react-navigation-menu',
        '@radix-ui/react-popover',
        '@radix-ui/react-progress',
        '@radix-ui/react-radio-group',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-select',
        '@radix-ui/react-separator',
        '@radix-ui/react-slider',
        '@radix-ui/react-slot',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-toast',
        '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group',
        '@radix-ui/react-tooltip',
        'class-variance-authority',
        'cmdk',
        'embla-carousel-react',
        'input-otp',
        'next-themes',
        'react-hook-form',
        'react-resizable-panels',
        'react-syntax-highlighter',
        'recharts',
        'sonner',
        'vaul',
        '@hello-pangea/dnd',
      ],
    },
    server: {
      proxy: {
        // Proxy API requests to the Flask server
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/,'/' ),
        },
      },
      host: '127.0.0.1',
      port: 5174,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
      },
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..', '../extensions', '../extensions/*', '../extensions/*/ui'],
        strict: false
      },
    },
    json: {
      stringify: true
    },
    optimizeDeps: {
      include: [
        'react-router-dom',
        'date-fns',
        'react-syntax-highlighter',
        'react-syntax-highlighter/dist/esm/styles/prism',
        '@hello-pangea/dnd',
      // Dynamically include extensions based on mode
      ...(isDevMode ? ['../extensions/**/ui/**/*.tsx'] : []),
    ],
    // Exclude npm extension packages from optimization in production
    exclude: isDevMode ? [] : ['@extensions/*'],
    // Force include workspace dependencies
      entries: [
        './src/**/*.tsx',
        './src/**/*.ts',
        ...(isDevMode ? ['../extensions/**/ui/**/*.tsx'] : []),
      ],
    },
    build: {
    commonjsOptions: {
      include: [
        /node_modules/,
        ...(isDevMode ? [/\/extensions\//] : [/@extensions/]),
      ],
    },
      rollupOptions: {
        external: [],
      // Ensure dynamic imports work correctly
      output: {
        manualChunks: (id) => {
          // Group all extension packages into separate chunks
          if (id.includes('@extensions')) {
            const extensionMatch = id.match(/@extensions\/([^/]+)/);
            if (extensionMatch) {
              return `extension-${extensionMatch[1]}`;
            }
          }
        }
      }
      },
    },
  };
});
