# Build und Deployment Anweisungen

## Entwicklungsumgebung einrichten

### Voraussetzungen

**Node.js und npm:**
- Node.js 18.x oder höher
- npm 9.x oder höher
- Empfohlen: Node Version Manager (nvm) verwenden

**Git:**
- Git 2.30 oder höher für Repository-Verwaltung

**Entwicklungstools:**
- Visual Studio Code (empfohlen)
- ESLint und Prettier Extensions

### Repository klonen

```bash
git clone https://github.com/[username]/portable-image-manager.git
cd portable-image-manager
```

### Dependencies installieren

```bash
# Alle Abhängigkeiten installieren
npm install

# Entwicklungsabhängigkeiten prüfen
npm audit
```

### Entwicklungsserver starten

```bash
# Entwicklungsmodus starten
npm run dev

# Oder mit Debug-Ausgabe
npm run dev:debug
```

## Projektstruktur

```
portable-image-manager/
├── src/
│   ├── main/                 # Electron Main Process
│   │   ├── services/         # Backend-Services
│   │   ├── repositories/     # Datenbank-Zugriff
│   │   └── ipc/             # IPC-Handler
│   ├── renderer/            # Electron Renderer Process
│   │   ├── src/
│   │   │   ├── components/  # React-Komponenten
│   │   │   ├── services/    # Frontend-Services
│   │   │   ├── hooks/       # Custom React Hooks
│   │   │   └── i18n/        # Internationalisierung
│   │   └── index.html
│   └── types/               # TypeScript-Definitionen
├── build/                   # Build-Artefakte
├── dist/                    # Distribution-Dateien
├── docs/                    # Dokumentation
├── scripts/                 # Build-Skripte
└── Assets/                  # Icons und Ressourcen
```

## Build-Konfiguration

### Electron Builder Konfiguration

Die Konfiguration befindet sich in `electron-builder.config.js`:

```javascript
module.exports = {
  appId: 'com.portable-image-manager.app',
  productName: 'Portable Image Manager',
  directories: {
    output: 'dist',
    buildResources: 'Assets'
  },
  files: [
    'build/**/*',
    'node_modules/**/*',
    '!node_modules/*/{CHANGELOG.md,README.md,readme.md}',
    '!node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!node_modules/*.d.ts',
    '!node_modules/.bin',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!.editorconfig',
    '!**/._*',
    '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
    '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
    '!**/{appveyor.yml,.travis.yml,circle.yml}',
    '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
  ],
  extraResources: [
    {
      from: 'Assets/',
      to: 'assets/',
      filter: ['**/*']
    }
  ]
};
```

### TypeScript Konfiguration

**Main Process (`tsconfig.main.json`):**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./build/main",
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": [
    "src/main/**/*",
    "src/types/**/*"
  ]
}
```

**Renderer Process (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "src/renderer/src",
    "src/types"
  ]
}
```

## Build-Prozess

### Entwicklungs-Build

```bash
# TypeScript kompilieren
npm run build:main
npm run build:renderer

# Oder beide gleichzeitig
npm run build
```

### Produktions-Build

```bash
# Vollständiger Produktions-Build
npm run build:prod

# Mit Optimierungen
npm run build:prod:optimized
```

### Portable Executable erstellen

```bash
# Windows Portable
npm run build:portable:win

# macOS Portable
npm run build:portable:mac

# Linux Portable
npm run build:portable:linux

# Alle Plattformen
npm run build:portable:all
```

## Plattform-spezifische Builds

### Windows

**Portable Executable:**
```bash
npm run build:win:portable
```

**Installer:**
```bash
npm run build:win:installer
```

**Konfiguration in `electron-builder.config.js`:**
```javascript
win: {
  target: [
    {
      target: 'portable',
      arch: ['x64', 'ia32']
    },
    {
      target: 'nsis',
      arch: ['x64', 'ia32']
    }
  ],
  icon: 'Assets/Logo.ico',
  requestedExecutionLevel: 'asInvoker'
}
```

### macOS

**DMG-Image:**
```bash
npm run build:mac:dmg
```

**App Bundle:**
```bash
npm run build:mac:app
```

**Konfiguration:**
```javascript
mac: {
  target: [
    {
      target: 'dmg',
      arch: ['x64', 'arm64']
    }
  ],
  icon: 'Assets/Logo.icns',
  category: 'public.app-category.photography'
}
```

### Linux

**AppImage:**
```bash
npm run build:linux:appimage
```

**Snap Package:**
```bash
npm run build:linux:snap
```

**Konfiguration:**
```javascript
linux: {
  target: [
    {
      target: 'AppImage',
      arch: ['x64']
    },
    {
      target: 'snap',
      arch: ['x64']
    }
  ],
  icon: 'Assets/Logo.png',
  category: 'Graphics'
}
```

## Optimierungen

### Bundle-Größe reduzieren

**Webpack-Optimierungen in `vite.config.ts`:**
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash', 'date-fns']
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

**Unnötige Dependencies entfernen:**
```bash
# Bundle-Analyzer verwenden
npm install --save-dev webpack-bundle-analyzer
npm run analyze

# Ungenutzte Dependencies finden
npm install --save-dev depcheck
npx depcheck
```

### Performance-Optimierungen

**Code-Splitting:**
```typescript
// Lazy Loading für große Komponenten
const ImageEditor = lazy(() => import('./components/editor/ImageEditor'));
const FullscreenViewer = lazy(() => import('./components/viewer/FullscreenViewer'));
```

**Asset-Optimierung:**
```bash
# Bilder komprimieren
npm install --save-dev imagemin imagemin-pngquant imagemin-mozjpeg

# SVG-Icons optimieren
npm install --save-dev svgo
```

## Testing

### Unit Tests

```bash
# Alle Tests ausführen
npm test

# Tests mit Coverage
npm run test:coverage

# Tests im Watch-Mode
npm run test:watch
```

### Integration Tests

```bash
# E2E Tests mit Electron
npm run test:e2e

# Performance Tests
npm run test:performance
```

### Test-Konfiguration

**Vitest Konfiguration (`vitest.config.ts`):**
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  }
});
```

## Continuous Integration

### GitHub Actions

**Workflow-Datei (`.github/workflows/build.yml`):**
```yaml
name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm run test
    - run: npm run build

  build:
    needs: test
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm run build:prod
    - name: Build Portable
      run: npm run build:portable
    - name: Upload Artifacts
      uses: actions/upload-artifact@v3
      with:
        name: portable-${{ matrix.os }}
        path: dist/
```

## Deployment

### Automatisches Deployment

**Release-Workflow (`.github/workflows/release.yml`):**
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm run build:portable:all
    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        files: dist/*
        draft: false
        prerelease: false
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Manuelles Deployment

**Release erstellen:**
```bash
# Version erhöhen
npm version patch  # oder minor/major

# Tag erstellen
git tag v1.0.0

# Build erstellen
npm run build:portable:all

# Release auf GitHub erstellen
gh release create v1.0.0 dist/* --title "Release v1.0.0" --notes "Release notes"
```

## Debugging

### Entwicklungs-Debugging

**Main Process debuggen:**
```bash
# Mit Node.js Debugger
npm run dev:debug:main

# Mit VS Code
# Launch-Konfiguration in .vscode/launch.json
```

**Renderer Process debuggen:**
```bash
# DevTools öffnen
npm run dev
# Dann F12 in der Anwendung
```

### Produktions-Debugging

**Log-Dateien aktivieren:**
```typescript
// In main.ts
import log from 'electron-log';

log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
```

**Crash-Reports:**
```typescript
import { crashReporter } from 'electron';

crashReporter.start({
  productName: 'Portable Image Manager',
  companyName: 'Your Company',
  submitURL: 'https://your-crash-server.com/submit',
  uploadToServer: false
});
```

## Wartung

### Dependencies aktualisieren

```bash
# Veraltete Packages prüfen
npm outdated

# Sicherheitsupdates
npm audit fix

# Major Updates (vorsichtig)
npm update
```

### Performance-Monitoring

**Bundle-Größe überwachen:**
```bash
# Bundle-Analyzer regelmäßig ausführen
npm run analyze

# Größe-Limits in package.json setzen
"bundlesize": [
  {
    "path": "./build/renderer/*.js",
    "maxSize": "2 MB"
  }
]
```

### Code-Qualität

**Linting und Formatting:**
```bash
# ESLint
npm run lint
npm run lint:fix

# Prettier
npm run format
npm run format:check
```

**Type-Checking:**
```bash
# TypeScript-Fehler prüfen
npm run type-check

# Strict Mode aktivieren
# In tsconfig.json: "strict": true
```

## Troubleshooting Build-Probleme

### Häufige Fehler

**"Cannot resolve module":**
- Dependencies installieren: `npm install`
- Cache löschen: `npm run clean`
- node_modules löschen und neu installieren

**"Out of memory":**
- Node.js Memory erhöhen: `NODE_OPTIONS="--max-old-space-size=4096"`
- Parallele Builds reduzieren

**"Permission denied":**
- Als Administrator ausführen (Windows)
- Berechtigungen prüfen: `chmod +x scripts/*`

**Electron-Builder Fehler:**
- Native Dependencies neu kompilieren: `npm run rebuild`
- Electron Version prüfen: `npm ls electron`

### Debug-Informationen sammeln

```bash
# Verbose Build-Output
npm run build -- --verbose

# Environment-Informationen
npm run env-info

# System-Informationen
node --version
npm --version
electron --version
```

## Checkliste für Release

- [ ] Alle Tests bestehen
- [ ] Code-Qualität geprüft (ESLint, Prettier)
- [ ] Dependencies aktualisiert
- [ ] Sicherheitsupdates installiert
- [ ] Bundle-Größe geprüft
- [ ] Performance-Tests bestanden
- [ ] Dokumentation aktualisiert
- [ ] Changelog erstellt
- [ ] Version erhöht
- [ ] Git-Tag erstellt
- [ ] Build für alle Plattformen erfolgreich
- [ ] Portable Executables getestet
- [ ] Release-Notes erstellt