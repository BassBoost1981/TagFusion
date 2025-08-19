# TagFusion - Portable Media Tagger

<div align="center">

<img src="Assets/Logo.svg" alt="TagFusion Logo" width="128" height="128">

**Hierarchical Media Tagging with EXIF/XMP Integration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-blue.svg)](https://www.microsoft.com/windows)
[![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-green.svg)](https://github.com/BassBoost1981/TagFusion/releases)
[![Electron](https://img.shields.io/badge/Electron-25.9.8-47848F.svg)](https://electronjs.org/)

[📥 Download](https://github.com/BassBoost1981/TagFusion/releases) • [🐛 Report Bug](https://github.com/BassBoost1981/TagFusion/issues) • [💡 Request Feature](https://github.com/BassBoost1981/TagFusion/issues)

</div>

---

## 🚀 What is TagFusion?

TagFusion is a **portable media tagger** for Windows that stores hierarchical tags directly in file metadata (EXIF/XMP). No installation required - just run the EXE!

### ✨ Key Features

🏷️ **Hierarchical Tag System** - Organize tags in categories and subcategories  
📁 **Portable Operation** - No installation, runs from USB stick  
💾 **EXIF/XMP Integration** - Tags stored directly in file metadata  
🎨 **Modern UI** - Dark/Light theme with responsive design  
🌍 **Multi-Language** - German, English, French, Spanish  
📤 **Import/Export** - Backup and share tag hierarchies  
⚡ **Fast Performance** - Handle thousands of files smoothly  

---

## 📥 Quick Start

### Download & Run
1. Download `TagFusion-1.0.0-portable.exe` from [Releases](https://github.com/BassBoost1981/TagFusion/releases)
2. Double-click to start - no installation needed!
3. Select a drive and start tagging your media files

### First Steps
1. **Navigate** to your media folder using the tree or favorites
2. **Select images** in the center panel
3. **Add tags** from the hierarchy or create new ones
4. **Tags are automatically saved** to file metadata

---

## 🏗️ Architecture

TagFusion uses a modern, portable architecture:

```
📦 TagFusion
├── 🖥️ Electron Frontend (HTML/CSS/JS)
├── 🔧 Node.js Backend (File System & Metadata)
├── 💾 Portable Data Storage (JSON files)
└── 🏷️ EXIF/XMP Integration (MetadataExtractor)
```

### Data Storage
- **Primary:** File metadata (EXIF/XMP/IPTC)
- **Secondary:** Local JSON files (backup & app data)
- **Portable:** All data stored next to EXE

---

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Windows 10/11

### Setup
```bash
# Clone repository
git clone https://github.com/BassBoost1981/TagFusion.git
cd TagFusion

# Install dependencies
npm install

# Start development
npm start

# Build portable EXE
npm run build
```

---

## 🏷️ Tag System

### Hierarchy Structure
```
📁 Categories
├── 👥 People
│   ├── 👨‍👩‍👧‍👦 Family
│   └── 👫 Friends
├── 🌍 Places
│   ├── 🏠 Home
│   └── ✈️ Travel
└── 🎉 Events
    ├── 🎂 Birthdays
    └── 🎄 Holidays
```

### Metadata Standards
- **IPTC Keywords** - Industry standard
- **XMP Tags** - Adobe standard
- **EXIF UserComment** - Camera standard
- **Hierarchical Subject** - Structured tags

---

## 🎯 Supported Formats

### Image Formats
| Format | Read Tags | Write Tags | Notes |
|--------|-----------|------------|-------|
| JPEG   | ✅        | ✅         | Full EXIF/XMP support |
| PNG    | ✅        | ✅         | XMP metadata |
| TIFF   | ✅        | ✅         | Full metadata support |
| RAW    | ✅        | ❌         | Read-only |

---

## ⚙️ Configuration

### Settings Location
- **Portable:** `data/settings.json` (next to EXE)
- **Development:** Browser localStorage

---

## 🔧 System Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10/11 (64-bit) |
| **RAM** | 4 GB recommended |
| **Storage** | 100 MB free space |
| **Permissions** | No admin rights needed |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by [BassBoost1981](https://github.com/BassBoost1981)**

⭐ **Star this repo if you find it useful!** ⭐

</div>
