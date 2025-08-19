/**
 * Debug Electron Builder Configuration
 * This version shows console output for debugging
 */

const path = require('path');

module.exports = {
  appId: 'com.portableimagemanager.test',
  productName: 'TagFusion Test',
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

  // Windows Configuration with console
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    icon: 'Assets/Logo.ico',
    requestedExecutionLevel: 'asInvoker',
    artifactName: '${productName}-${version}-${arch}-${target}.${ext}',
    publisherName: 'Portable Image Manager Debug',
    verifyUpdateCodeSignature: false,
    
    // Debug configuration - no console option available
    
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
    unpackDirName: 'TagFusion Test',
    unicode: false
  },

  // Compression and optimization
  compression: 'normal',
  
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
