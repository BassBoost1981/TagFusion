module.exports = {
  appId: "com.tagfusion.app",
  productName: "TagFusion",
  copyright: "Copyright © 2025 BassBoost1981",
  directories: {
    output: "release"
  },
  files: [
    "main.js",
    "preload.js",
    "index.html",
    "styles.css",
    "app.js",
    "Font/**/*",
    "Assets/**/*",
    "node_modules/**/*"
  ],
  win: {
    target: {
      target: "portable",
      arch: ["x64"]
    },
    icon: "Assets/Logo.ico",
    artifactName: "TagFusion-${version}-portable.${ext}",
    requestedExecutionLevel: "asInvoker",
    verifyUpdateCodeSignature: false
  },
  portable: {
    artifactName: "TagFusion-${version}-portable.${ext}"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  }
};
