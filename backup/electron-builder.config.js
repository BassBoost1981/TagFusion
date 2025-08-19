/**
 * Electron Builder Configuration for Portable Image Manager
 * This configuration ensures the application is truly portable without system dependencies
 */

const path = require('path');

module.exports = {
  appId: 'com.portableimagemanager.app',
  productName: 'Portable Image Manager',
  copyright: 'Copyright © 2024 Portable Image Manager',
  
  directories: {
    output: 'release',
    buildResources: 'build'
  },

  files: [
    'dist/**/*',
    'node_modules/**/*',
    // Exclude unnecessary files to reduce bundle size
    '!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
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
    },
    {
      from: 'build/.portable',
      to: '.portable'
    }
  ],

  // Windows Configuration - Only x64 portable
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    icon: 'Assets/Logo.ico',
    requestedExecutionLevel: 'asInvoker', // No admin rights required
    artifactName: '${productName}-${version}-${arch}-${target}.${ext}',
    publisherName: 'Portable Image Manager',
    verifyUpdateCodeSignature: false,
    
    // Ensure all dependencies are bundled
    extraFiles: [
      {
        from: 'node_modules/sharp/build/Release',
        to: 'resources/sharp',
        filter: ['**/*']
      }
    ]
  },

  // Portable-specific configuration
  portable: {
    artifactName: '${productName}-${version}-${arch}-portable.${ext}',
    requestExecutionLevel: 'user',
    unpackDirName: 'Portable Image Manager',
    splashImage: 'Assets/Logo.ico',
    // Ensure portable app doesn't write to system locations
    unicode: false
  },

  // NSIS installer configuration (for non-portable version)
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: false,
    allowElevation: false, // No admin rights required
    installerIcon: 'Assets/Logo.ico',
    uninstallerIcon: 'Assets/Logo.ico',
    installerHeaderIcon: 'Assets/Logo.ico',
    deleteAppDataOnUninstall: true,
    artifactName: '${productName}-${version}-${arch}-installer.${ext}'
  },

  // macOS Configuration
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'Assets/Logo.icns',
    category: 'public.app-category.photography',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist'
  },

  // Linux Configuration
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'tar.gz',
        arch: ['x64']
      }
    ],
    icon: 'Assets/Logo.png',
    category: 'Graphics',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    desktop: {
      Name: 'Portable Image Manager',
      Comment: 'A portable image management application',
      Categories: 'Graphics;Photography;Viewer;'
    }
  },

  // Compression and optimization
  compression: 'maximum',
  
  // Files that should not be packed into asar archive
  asarUnpack: [
    '**/node_modules/sharp/**/*',
    '**/node_modules/@ffmpeg/**/*',
    '**/node_modules/electron/**/*',
    '**/dist/renderer/**/*'
  ],

  // Publish configuration (disabled for portable app)
  publish: null,

  // Build configuration
  buildDependenciesFromSource: false,
  nodeGypRebuild: false,
  npmRebuild: true,


};