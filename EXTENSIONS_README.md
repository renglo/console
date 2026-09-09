# Console Extension System - Guide

## Overview

Console is a tool that can load extensions from:
- ✅ Local `../extensions/` directory (for development)
- ✅ Published npm packages (for production)
- ✅ Mix of both (hybrid mode)

**Key Benefits:**
- No hardcoded tool references in Console
- Single `node_modules` with automatic dependency hoisting
- Add unlimited tools without modifying Console code
- Each tool declares its own dependencies

## Quick Start: Initial Setup

### Step 1: Create extensions Directory

```bash
cd /path/to/your_sys_1
mkdir -p extensions
```

### Step 2: Clone Tools in the extensions directory

```bash
# Clone tools into the extensions directory
cd extensions
git clone [git_repository_url_extension_x]
```


### Step 3: Install with Workspace

```bash
cd console

# Clean old installations
rm -rf node_modules package-lock.json
rm package-lock.json

# Install everything (workspace auto-discovers extensions)
npm install
```

### Step 4: Check that your local .env.development file has these settings

```bash
VITE_API_URL='http://127.0.0.1:5001'
VITE_DEV_MODE=true
```

Console discovers every `extensions/*/ui` pack (and npm-pinned UI packages). You do not list them in env.

### Step 5: Start Environment

```bash
npm run dev
```






## How to Create a New Extension

### Method 1: Create New Extension from Scratch

```bash
# 1. Create extension directory
cd extensions
mkdir -p my-new-extension
cd my-new-extension

# 2. Create package.json
cat > package.json << 'EOF'
{
  "name": "@renglo/my-new-extension",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./my-new-extension.tsx",
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "dependencies": {
  }
}
EOF

# 3. Create main component
cat > my-new-extension.tsx << 'EOF'
export default function MyNewExtension({ 
  portfolio, 
  org, 
  tool, 
  section,
  tree,
  query,
  onNavigate 
}) {
  return (
    <div className="p-4">
      <h1>My New Extension</h1>
      <p>Portfolio: {portfolio}</p>
      <p>Organization: {org}</p>
    </div>
  );
}
EOF

# 4. Create navigation (optional)
mkdir -p navigation
cat > navigation/my-new-extension_sidenav.tsx << 'EOF'
export default function MyNewToolSideNav({ 
  portfolio, 
  org, 
  tool, 
  section, 
  onNavigate 
}) {
  return (
    <nav className="w-64 p-4">
      <h2>My Extension Nav</h2>
      <button onClick={() => onNavigate(`/${portfolio}/${org}/${tool}/dashboard`)}>
        Dashboard
      </button>
    </nav>
  );
}
EOF

# 5. Restart Vite — console discovers the new folder automatically
cd ../../console

# 6. Install (workspace auto-discovers)
npm install

# Done!
npm run dev
```

### Method 2: Install Existing Tool

```bash
# 1. Clone tool repository
cd tools
git clone https://github.com/your-org/some-extension.git

# 2. Ensure it has package.json
cd some-extension
# If no package.json, create one (see structure below)

# 3. Restart Vite — console discovers the clone automatically
cd ../../console

# 4. Install
npm install

# Done!
```

### Method 3: Install from npm

```bash
cd console

# Install published extension
npm install @extensions/some-extension@1.0.0

# Set production mode
echo "VITE_DEV_MODE=false" > .env.local

# Run
npm run dev
```

## Extension Structure Requirements

### Required Files

```
[extension-name]/
├── package.json              # Required: Extension metadata
├── [extension-name].tsx          # Required: Main component
├── navigation/              # Optional: Navigation
│   ├── [extension-name]_sidenav.tsx
│   └── [extension-name]_sheetnav.tsx
└── onboarding/             # Optional: Bootstrap
    └── [extension-name]_onboarding.tsx
```

### Required package.json Fields

```json
{
  "name": "@renglo/[extension-name]",    // Required: Must follow this pattern
  "version": "1.0.0",                     // Required: Semantic version
  "type": "module",                       // Required: ESM
  "main": "./[extension-name].tsx",           // Required: Entry point
  "peerDependencies": {                  // Required: Shared deps
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "dependencies": {                      // Optional: Tool-specific deps
    "recharts": "^2.15.1",
    "leaflet": "^1.9.4"
  }
}
```



