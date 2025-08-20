// TagFusion - Main Application JavaScript

console.log('🎯 TagFusion App gestartet!');

// ===== REMOVED SPLASH SCREEN SYSTEM =====
// Splash screen is now handled by separate window in main.js

// DOM Elements
const searchInput = document.getElementById('searchInput');
const tagTree = document.getElementById('tagTree');
const fileGrid = document.getElementById('fileGrid');
const driveOverview = document.getElementById('driveOverview');
const driveGrid = document.getElementById('driveGrid');
const tagInput = document.getElementById('tagInput');
const currentTags = document.getElementById('currentTags');
const fileCount = document.getElementById('fileCount');
const statusMessage = document.getElementById('statusMessage');
const themeToggle = document.getElementById('themeToggle');

// Application State
let selectedFiles = [];
let selectedFileElements = []; // DOM-Elemente der ausgewählten Dateien
let lastSelectedIndex = -1; // Für Shift-Auswahl
let currentFileTags = [];
let allFiles = [];
let filteredFiles = []; // Gefilterte Dateien
let currentDirectory = null;
let availableDrives = [];
let favorites = [];
let currentFilter = 'all';
let tagHierarchy = {
  categories: []
};

// Theme Management
async function initializeTheme() {
  let initialTheme = 'light';

  // 1. Versuche System Theme zu ermitteln
  try {
    if (window.electronAPI && window.electronAPI.system) {
      const systemTheme = await window.electronAPI.system.getSystemTheme();
      initialTheme = systemTheme;
      console.log(`🎨 Windows Theme erkannt: ${systemTheme}`);

      // Höre auf System Theme Änderungen
      window.electronAPI.system.onSystemThemeChanged((newTheme) => {
        console.log(`🎨 Windows Theme geändert: ${newTheme}`);
        setTheme(newTheme);
      });
    }
  } catch (error) {
    console.log('⚠️ System Theme Detection fehlgeschlagen, verwende gespeicherte Einstellung');
  }

  // 2. Fallback: Gespeicherte Einstellung verwenden
  const savedTheme = localStorage.getItem('tagfusion-theme');
  if (savedTheme) {
    initialTheme = savedTheme;
    console.log(`💾 Gespeichertes Theme: ${savedTheme}`);
  }

  setTheme(initialTheme);
}

function setTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️';
    themeToggle.title = 'Light Mode';
  } else {
    document.body.classList.remove('dark-mode');
    themeToggle.textContent = '🌙';
    themeToggle.title = 'Dark Mode';
  }
  localStorage.setItem('tagfusion-theme', theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  setTheme(isDark ? 'light' : 'dark');
}

// ===== DRIVE OVERVIEW SYSTEM =====

// Render drive overview
function renderDriveOverview() {
  if (!driveGrid) return;

  console.log('💾 Rendere Laufwerks-Übersicht...');

  if (!availableDrives || availableDrives.length === 0) {
    driveGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🖥️</div>
        <div class="empty-text">Keine Laufwerke gefunden</div>
        <div class="empty-subtext">Überprüfe die Systemverbindungen</div>
      </div>
    `;
    return;
  }

  driveGrid.innerHTML = availableDrives.map(drive => {
    const usagePercent = drive.totalSpace > 0 ?
      Math.round(((drive.totalSpace - drive.freeSpace) / drive.totalSpace) * 100) : 0;

    const usageClass = usagePercent > 80 ? 'high' : usagePercent > 60 ? 'medium' : 'low';
    const driveType = getDriveType(drive);
    const driveIcon = getDriveIcon(drive);

    return `
      <div class="drive-card" data-path="${drive.path}">
        <div class="drive-icon ${driveType}">
          ${driveIcon}
        </div>
        <div class="drive-info">
          <div class="drive-name">${drive.name || drive.path}</div>
          <div class="drive-label">${drive.label || 'Lokaler Datenträger'} (${drive.path})</div>

          <div class="drive-usage">
            <div class="drive-usage-bar">
              <div class="drive-usage-fill ${usageClass}" style="width: ${usagePercent}%"></div>
            </div>
            <div class="drive-usage-text">
              <span>${formatBytes(drive.totalSpace - drive.freeSpace)} belegt</span>
              <span>${formatBytes(drive.freeSpace)} frei von ${formatBytes(drive.totalSpace)}</span>
            </div>
          </div>

          <div class="drive-stats">
            <div class="drive-stat">
              <span>📊</span>
              <span>${usagePercent}% belegt</span>
            </div>
            <div class="drive-stat">
              <span>🖥️</span>
              <span>${drive.fileSystem || 'NTFS'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Event-Listener für Laufwerk-Karten hinzufügen
  setTimeout(() => {
    const driveCards = driveGrid.querySelectorAll('.drive-card');
    driveCards.forEach(card => {
      card.addEventListener('click', () => {
        const drivePath = card.dataset.path;
        if (drivePath) {
          selectDrive(drivePath);
        }
      });
    });
  }, 100);

  console.log(`✅ ${availableDrives.length} Laufwerke gerendert`);
}

// Get drive type for styling
function getDriveType(drive) {
  const path = drive.path.toLowerCase();
  if (path === 'c:') return 'system';
  if (drive.label && (drive.label.includes('SSD') || drive.label.includes('NVMe'))) return 'ssd';
  if (drive.isRemovable) return 'external';
  return 'data';
}

// Get drive icon
function getDriveIcon(drive) {
  const path = drive.path.toLowerCase();
  if (path === 'c:') return '🖥️';
  if (drive.label && (drive.label.includes('SSD') || drive.label.includes('NVMe'))) return '⚡';
  if (drive.isRemovable) return '🔌';
  return '🗄️'; // Moderne Festplatte/Server-Symbol
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Select drive and switch to file view
function selectDrive(drivePath) {
  console.log(`💾 Laufwerk ausgewählt: ${drivePath}`);

  // Hide drive overview, show file grid
  if (driveOverview) driveOverview.style.display = 'none';
  if (fileGrid) {
    fileGrid.style.display = 'block';

    // Stelle sicher, dass Grid-View aktiv ist
    fileGrid.classList.remove('list-view');
    fileGrid.classList.add('grid-view');

    console.log('🔧 Grid-View aktiviert:', {
      classList: fileGrid.classList.toString(),
      computedColumns: window.getComputedStyle(fileGrid).gridTemplateColumns
    });
  }

  // Setze Grid-View-Button als aktiv
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  const gridViewBtn = document.querySelector('.view-btn[data-view="grid"]');
  if (gridViewBtn) gridViewBtn.classList.add('active');

  // Load directory contents
  loadDirectory(drivePath);

  // Update breadcrumb
  updateBreadcrumb(drivePath);
}

// Show drive overview
function showDriveOverview() {
  console.log('💾 Zeige Laufwerks-Übersicht');

  if (driveOverview) driveOverview.style.display = 'block';
  if (fileGrid) fileGrid.style.display = 'none';

  // Clear current directory
  currentDirectory = null;
  allFiles = [];
  filteredFiles = [];

  // Update UI
  updateFileCount(0);
  updateStatus('Laufwerks-Übersicht');

  // Update breadcrumb
  const breadcrumb = document.querySelector('.breadcrumb span');
  if (breadcrumb) {
    breadcrumb.textContent = 'Laufwerke';
  }
}

// File System Functions
async function loadDrives() {
  try {
    if (window.electronAPI && window.electronAPI.fileSystem) {
      availableDrives = await window.electronAPI.fileSystem.getDrives();
      console.log('💾 Laufwerke geladen:', availableDrives);

      // Render both drive tree and drive overview
      renderDriveTree();
      renderDriveOverview();

      updateStatus(`${availableDrives.length} Laufwerke verfügbar`);
      return availableDrives;
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Laufwerke:', error);
    updateStatus('Fehler beim Laden der Laufwerke');
  }
  return [];
}

async function loadDirectory(dirPath) {
  try {
    updateStatus(`Lade ${dirPath}...`);
    console.log(`📁 Lade Verzeichnis: ${dirPath}`);

    // Show loading notification
    showInfoNotification('Verzeichnis laden', `Lade Dateien aus ${dirPath}...`);

    // Speichere aktuellen Pfad
    currentDirectory = dirPath;

    // Hide drive overview and show file grid
    const driveOverview = document.getElementById('driveOverview');
    const fileGrid = document.getElementById('fileGrid');

    if (driveOverview) driveOverview.style.display = 'none';
    if (fileGrid) {
      fileGrid.style.display = 'block';
      // Stelle sicher, dass Grid-View aktiv ist
      fileGrid.classList.remove('list-view');
      fileGrid.classList.add('grid-view');
    }

    if (window.electronAPI && window.electronAPI.fileSystem) {
      const contents = await window.electronAPI.fileSystem.getDirectoryContents(dirPath);

      // Bilder, Videos und Ordner für allFiles
      allFiles = contents.filter(item =>
        item.type === 'image' ||
        item.type === 'video' ||
        item.type === 'directory'
      );

      // Initialize and load tags for all files
      console.log(`📁 Lade Tags für ${allFiles.length} Dateien...`);

      for (const file of allFiles) {
        if (!file.tags) {
          file.tags = [];
        }
        if (!file.rating) {
          file.rating = 0;
        }

        // Load tags for images and videos
        if (file.type === 'image' || file.type === 'video') {
          await loadFileTags(file);
        }

        // Debug: Log files with tags
        if (file.tags && file.tags.length > 0) {
          console.log(`🏷️ Datei mit ${file.tags.length} Tags:`, file.name, file.tags);
        }
      }

      console.log(`✅ Tags für alle Dateien geladen`);

      currentDirectory = dirPath;

      const imageCount = contents.filter(item => item.type === 'image').length;
      const videoCount = contents.filter(item => item.type === 'video').length;
      const folderCount = contents.filter(item => item.type === 'directory').length;

      console.log(`📁 ${folderCount} Ordner, 🖼️ ${imageCount} Bilder, 🎬 ${videoCount} Videos gefunden in ${dirPath}`);

      // Apply current filter
      applyFilter(currentFilter);

      // Force Grid-View nach dem Laden
      setTimeout(() => {
        const fileGrid = document.getElementById('fileGrid');
        if (fileGrid) {
          fileGrid.classList.remove('list-view');
          fileGrid.classList.add('grid-view');
          console.log('🔧 Grid-View nach Laden forciert:', fileGrid.classList.toString());
        }
      }, 100);

      updateBreadcrumb(dirPath);
      updateStatus(`${allFiles.length} Elemente geladen (${folderCount} Ordner, ${imageCount} Bilder, ${videoCount} Videos)`);

      // Show success notification
      showSuccessNotification('Verzeichnis geladen', `${allFiles.length} Elemente erfolgreich geladen`);

      // Synchronisiere Baumstruktur mit aktuellem Pfad
      console.log(`🔄 STARTE Baum-Synchronisation für: ${dirPath}`);
      await syncTreeWithCurrentPath(dirPath);
      console.log(`✅ BEENDET Baum-Synchronisation für: ${dirPath}`);

      return contents;
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden des Verzeichnisses:', error);
    updateStatus('Fehler beim Laden des Verzeichnisses');
  }
  return [];
}

function renderDriveTree() {
  const driveTree = document.getElementById('driveTree');
  if (!driveTree || !availableDrives.length) return;

  driveTree.innerHTML = '';

  availableDrives.forEach(drive => {
    const driveItem = createTreeNode(drive.name, drive.path, 'drive', true);
    driveTree.appendChild(driveItem);
  });
}

function createTreeNode(name, path, type = 'directory', hasChildren = false, level = 0) {
  const treeItem = document.createElement('div');
  treeItem.className = `tree-item ${type}-item`;
  treeItem.dataset.path = path;
  treeItem.dataset.level = level;
  treeItem.dataset.expanded = 'false';

  const indent = '  '.repeat(level);
  const toggleIcon = hasChildren ? '▶' : '';
  const typeIcon = type === 'drive' ? '🗄️' : '📁';

  treeItem.innerHTML = `
    <span class="tree-indent">${indent}</span>
    <span class="tree-toggle ${hasChildren ? 'has-children' : ''}">${toggleIcon}</span>
    <span class="tree-icon">${typeIcon}</span>
    <span class="tree-label">${name}</span>
  `;

  // Event Listeners
  const toggle = treeItem.querySelector('.tree-toggle');
  const label = treeItem.querySelector('.tree-label');

  // Toggle für Expand/Collapse
  if (hasChildren) {
    toggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleTreeNode(treeItem);
    });
  }

  // Label für Ordner-Inhalt laden
  label.addEventListener('click', async (e) => {
    e.stopPropagation();
    await loadDirectory(path);
    highlightSelectedNode(treeItem);
  });

  return treeItem;
}

async function toggleTreeNode(treeItem) {
  const isExpanded = treeItem.dataset.expanded === 'true';
  const path = treeItem.dataset.path;
  const level = parseInt(treeItem.dataset.level);
  const toggle = treeItem.querySelector('.tree-toggle');

  if (isExpanded) {
    // Collapse: Entferne alle Kinder-Knoten
    collapseNode(treeItem);
    toggle.textContent = '▶';
    treeItem.dataset.expanded = 'false';
  } else {
    // Expand: Lade und zeige Kinder-Knoten
    toggle.textContent = '▼';
    treeItem.dataset.expanded = 'true';

    try {
      updateStatus(`Lade Ordner-Struktur...`);
      const directories = await window.electronAPI.fileSystem.getDirectories(path);

      // Füge Kinder-Knoten nach dem aktuellen Knoten ein
      let insertAfter = treeItem;
      directories.forEach(dir => {
        const childNode = createTreeNode(dir.name, dir.path, 'directory', dir.hasSubdirectories, level + 1);
        insertAfter.parentNode.insertBefore(childNode, insertAfter.nextSibling);
        insertAfter = childNode;
      });

      updateStatus('Bereit');
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unterordner:', error);
      updateStatus('Fehler beim Laden der Ordner-Struktur');
    }
  }
}

function collapseNode(treeItem) {
  const level = parseInt(treeItem.dataset.level);
  let nextSibling = treeItem.nextSibling;

  // Entferne alle nachfolgenden Knoten mit höherem Level
  while (nextSibling) {
    const siblingLevel = parseInt(nextSibling.dataset?.level || -1);
    if (siblingLevel <= level) break;

    const toRemove = nextSibling;
    nextSibling = nextSibling.nextSibling;
    toRemove.remove();
  }
}

function highlightSelectedNode(selectedNode) {
  // Entferne vorherige Auswahl
  document.querySelectorAll('.tree-item').forEach(item => {
    item.classList.remove('selected');
  });

  // Markiere aktuellen Knoten
  if (selectedNode) {
    selectedNode.classList.add('selected');

    // Scrolle zum ausgewählten Knoten, falls nötig
    selectedNode.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });

    console.log(`🎯 Knoten ausgewählt: ${selectedNode.dataset.path}`);
  }
}

// Synchronisiere Baumstruktur mit aktuellem Pfad
async function syncTreeWithCurrentPath(currentPath) {
  try {
    console.log(`🔄 Synchronisiere Baum mit: ${currentPath}`);

    // Prüfe ob Baumstruktur existiert
    const treeContainer = document.querySelector('.drive-tree');
    if (!treeContainer) {
      console.error('❌ Baumstruktur-Container nicht gefunden!');
      return;
    }

    console.log(`📊 Anzahl Baum-Knoten: ${treeContainer.querySelectorAll('[data-path]').length}`);

    // Warte kurz, damit die Baumstruktur vollständig geladen ist
    await new Promise(resolve => setTimeout(resolve, 500));

    // Erweitere Baum zum aktuellen Pfad
    console.log(`🌳 Starte expandTreeToPath für: ${currentPath}`);
    await expandTreeToPath(currentPath);

    // Markiere aktuellen Knoten als ausgewählt
    const normalizedPath = currentPath.replace(/\//g, '\\');
    console.log(`🔍 Suche Knoten für normalisierten Pfad: ${normalizedPath}`);

    let currentNode = document.querySelector(`[data-path="${normalizedPath}"]`);
    console.log(`🎯 Knoten gefunden (1. Versuch): ${currentNode ? 'JA' : 'NEIN'}`);

    // Fallback: Versuche ohne trailing backslash
    if (!currentNode && normalizedPath.endsWith('\\')) {
      const pathWithoutSlash = normalizedPath.slice(0, -1);
      console.log(`🔍 Fallback-Suche ohne Backslash: ${pathWithoutSlash}`);
      currentNode = document.querySelector(`[data-path="${pathWithoutSlash}"]`);
      console.log(`🎯 Knoten gefunden (2. Versuch): ${currentNode ? 'JA' : 'NEIN'}`);
    }

    // Fallback: Case-insensitive Suche
    if (!currentNode) {
      console.log(`🔍 Case-insensitive Fallback-Suche...`);
      const allNodes = document.querySelectorAll('[data-path]');
      console.log(`📊 Durchsuche ${allNodes.length} Knoten...`);

      for (const node of allNodes) {
        const nodePath = node.dataset.path.toLowerCase();
        const searchPath = normalizedPath.toLowerCase();
        if (nodePath === searchPath || nodePath === searchPath.slice(0, -1)) {
          currentNode = node;
          console.log(`🎯 Knoten gefunden (case-insensitive): ${node.dataset.path}`);
          break;
        }
      }
    }

    if (currentNode) {
      highlightSelectedNode(currentNode);
      console.log(`✅ Baum synchronisiert mit: ${currentPath} → ${currentNode.dataset.path}`);
    } else {
      console.warn(`⚠️ Knoten nicht gefunden für: ${currentPath}`);
      // Debug: Zeige alle verfügbaren Pfade
      const allPaths = Array.from(document.querySelectorAll('[data-path]')).map(n => n.dataset.path);
      console.log(`📋 Verfügbare Pfade:`, allPaths.slice(0, 10)); // Nur erste 10
    }
  } catch (error) {
    console.error('❌ Fehler bei Baum-Synchronisation:', error);
  }
}

// Erweitere Baumstruktur bis zum angegebenen Pfad
async function expandTreeToPath(targetPath) {
  try {
    console.log(`🌳 Erweitere Baum zu: ${targetPath}`);

    // Normalisiere Pfad
    const normalizedPath = targetPath.replace(/\//g, '\\');
    const pathParts = normalizedPath.split('\\').filter(part => part);

    if (pathParts.length === 0) return;

    // Starte mit dem Laufwerk
    const driveLetter = pathParts[0].toUpperCase();
    // Das korrekte Format ist mit doppelten Backslashes im DOM
    let currentPath = driveLetter.endsWith(':') ? driveLetter + '\\\\' : driveLetter + ':\\\\';

    console.log(`🔍 Suche Laufwerk-Knoten für: ${currentPath}`);

    // Finde und erweitere Laufwerk
    let currentNode = document.querySelector(`[data-path="${currentPath}"]`);
    if (!currentNode) {
      // Fallback: Versuche mit verschiedenen Formaten
      const alternatives = [
        `${driveLetter}:\\\\`,  // Doppelte Backslashes (wie in der Liste)
        `${driveLetter}:`,
        `${driveLetter}`,
        `${driveLetter.toLowerCase()}:\\\\`,
        `${driveLetter.toLowerCase()}:\\`,
        `${driveLetter.toLowerCase()}:`
      ];

      console.log(`🔍 Fallback-Suche für Laufwerk mit: ${alternatives.join(', ')}`);

      for (const alt of alternatives) {
        currentNode = document.querySelector(`[data-path="${alt}"]`);
        if (currentNode) {
          console.log(`✅ Laufwerk gefunden mit Format: ${alt}`);
          break;
        }
      }
    }

    if (!currentNode) {
      console.warn(`⚠️ Laufwerk-Knoten nicht gefunden: ${currentPath}`);
      // Debug: Zeige alle verfügbaren Laufwerk-Pfade
      const allDriveNodes = document.querySelectorAll('[data-path*=":"]');
      const drivePaths = Array.from(allDriveNodes).map(n => n.dataset.path);
      console.log(`📋 Verfügbare Laufwerk-Pfade:`, drivePaths);
      return;
    }

    // Erweitere jeden Pfad-Teil
    for (let i = 1; i < pathParts.length; i++) {
      const partName = pathParts[i];
      currentPath = currentPath + partName + '\\';

      console.log(`🔍 Suche Knoten für: ${currentPath}`);

      // Erweitere aktuellen Knoten falls nötig
      if (currentNode && currentNode.dataset.expanded !== 'true') {
        console.log(`📂 Erweitere Knoten: ${currentNode.dataset.path}`);
        await toggleTreeNode(currentNode);

        // Warte länger für DOM-Update
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Finde nächsten Knoten mit verschiedenen Formaten
      let nextNode = document.querySelector(`[data-path="${currentPath}"]`);
      if (!nextNode) {
        // Versuche ohne trailing backslash
        const pathWithoutSlash = currentPath.slice(0, -1);
        nextNode = document.querySelector(`[data-path="${pathWithoutSlash}"]`);
      }
      if (!nextNode) {
        // Versuche case-insensitive
        const allNodes = document.querySelectorAll('[data-path]');
        for (const node of allNodes) {
          if (node.dataset.path.toLowerCase() === currentPath.toLowerCase() ||
              node.dataset.path.toLowerCase() === currentPath.slice(0, -1).toLowerCase()) {
            nextNode = node;
            break;
          }
        }
      }

      if (!nextNode) {
        console.warn(`⚠️ Pfad-Teil nicht gefunden: ${currentPath}`);
        break;
      }

      console.log(`✅ Knoten gefunden: ${nextNode.dataset.path}`);
      currentNode = nextNode;
    }

    // Markiere finalen Knoten
    if (currentNode) {
      highlightSelectedNode(currentNode);
      console.log(`🎯 Finaler Knoten markiert: ${currentNode.dataset.path}`);

      // Scrolle zu dem Knoten
      currentNode.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }

  } catch (error) {
    console.error('❌ Fehler beim Erweitern der Baumstruktur:', error);
  }
}

function updateBreadcrumb(path) {
  const breadcrumb = document.querySelector('.breadcrumb');
  if (breadcrumb) {
    breadcrumb.textContent = path || 'Alle Bilder';
  }
}

// Favorites Management (Portable)
async function loadFavorites() {
  try {
    const saved = await portableData.readData('favorites');
    favorites = saved || [];
    renderFavorites();
    console.log(`📁 ${favorites.length} Favoriten geladen`);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Favoriten:', error);
    favorites = [];
    renderFavorites();
  }
}

async function saveFavorites() {
  try {
    await portableData.writeData('favorites', favorites);
    console.log(`💾 ${favorites.length} Favoriten gespeichert`);
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Favoriten:', error);
  }
}

function addToFavorites() {
  if (!currentDirectory) {
    updateStatus('Kein Ordner ausgewählt');
    return;
  }

  // Prüfe ob bereits in Favoriten
  if (favorites.some(fav => fav.path === currentDirectory)) {
    updateStatus('Ordner bereits in Favoriten');
    return;
  }

  const folderName = currentDirectory.split('\\').pop() || currentDirectory;
  favorites.push({
    name: folderName,
    path: currentDirectory,
    added: new Date().toISOString()
  });

  saveFavorites();
  renderFavorites();
  updateStatus(`"${folderName}" zu Favoriten hinzugefügt`);
}

function removeFromFavorites(path) {
  favorites = favorites.filter(fav => fav.path !== path);
  saveFavorites();
  renderFavorites();
  updateStatus('Favorit entfernt');
}

function renderFavorites() {
  const favoritesList = document.getElementById('favoritesList');
  if (!favoritesList) return;

  // Behalte Standard-Favoriten
  const defaultFavorites = favoritesList.querySelectorAll('.default-favorite');
  favoritesList.innerHTML = '';

  // Füge Standard-Favoriten wieder hinzu
  defaultFavorites.forEach(item => favoritesList.appendChild(item));

  // Füge benutzerdefinierte Favoriten hinzu
  favorites.forEach(favorite => {
    const favoriteItem = document.createElement('div');
    favoriteItem.className = 'favorite-item custom-favorite';
    favoriteItem.dataset.path = favorite.path;
    favoriteItem.innerHTML = `
      <span class="favorite-icon">⭐</span>
      <span class="favorite-name" title="${favorite.path}">${favorite.name}</span>
      <button class="remove-favorite" onclick="removeFromFavorites('${favorite.path.replace(/\\/g, '\\\\')}')" title="Entfernen">×</button>
    `;

    favoriteItem.addEventListener('click', async (e) => {
      if (e.target.classList.contains('remove-favorite')) return;

      // Hide drive overview and show file grid
      if (driveOverview) driveOverview.style.display = 'none';
      if (fileGrid) {
        fileGrid.style.display = 'block';
        // Stelle sicher, dass Grid-View aktiv ist
        fileGrid.classList.remove('list-view');
        fileGrid.classList.add('grid-view');
      }

      await loadDirectory(favorite.path);
      await expandTreeToPath(favorite.path);
    });

    favoritesList.appendChild(favoriteItem);
  });
}

// Tag Hierarchy Management (Portable)
async function loadTagHierarchy() {
  try {
    const saved = await portableData.readData('tagHierarchy');
    if (saved) {
      tagHierarchy = saved;
    } else {
    // Leere Tag-Hierarchie beim ersten Start
    tagHierarchy = {
      categories: []  // Komplett leer
    };
    await saveTagHierarchy();
  }
  renderTagHierarchy();

  const totalTags = tagHierarchy.categories.reduce((sum, cat) =>
    sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.tags.length, 0), 0
  );
  console.log(`🏷️ Tag-Hierarchie geladen: ${tagHierarchy.categories.length} Kategorien, ${totalTags} Tags`);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Tag-Hierarchie:', error);
    // Fallback zu leerer Hierarchie
    tagHierarchy = {
      categories: []  // Leer bei Fehlern
    };
    renderTagHierarchy();
  }
}

async function saveTagHierarchy() {
  try {
    await portableData.writeData('tagHierarchy', tagHierarchy);
    const totalTags = tagHierarchy.categories.reduce((sum, cat) =>
      sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.tags.length, 0), 0
    );
    console.log(`💾 Tag-Hierarchie gespeichert: ${tagHierarchy.categories.length} Kategorien, ${totalTags} Tags`);
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Tag-Hierarchie:', error);
  }
}

function renderTagHierarchy() {
  const tagTreeContainer = document.getElementById('tagTree');
  if (!tagTreeContainer) {
    console.error('❌ tagTree Container nicht gefunden!');
    return;
  }

  console.log(`🌳 Rendere ${tagHierarchy.categories.length} Kategorien...`);
  tagTreeContainer.innerHTML = '';

  tagHierarchy.categories.forEach(category => {
    console.log(`📁 Erstelle Kategorie: ${category.name}`);
    const categoryElement = createTreeCategoryElement(category);
    tagTreeContainer.appendChild(categoryElement);
  });

  // Event-Listener nach dem Rendern neu einrichten
  setTimeout(() => {
    setupTreeEventListeners();
    console.log('✅ Tag-Hierarchie gerendert und Event-Listener eingerichtet');
  }, 100);
}

function createTreeCategoryElement(category) {
  // Haupt-Container für die gesamte Kategorie
  const categoryContainer = document.createElement('div');
  categoryContainer.className = 'category-container';

  // Kategorie-Item (die Zeile mit dem Namen)
  const categoryDiv = document.createElement('div');
  categoryDiv.className = 'tree-item category draggable';
  categoryDiv.dataset.type = 'category';
  categoryDiv.dataset.id = category.id;

  const hasSubcategories = category.subcategories && category.subcategories.length > 0;
  const toggleIcon = hasSubcategories ? '▼' : '▶';

  categoryDiv.innerHTML = `
    <span class="tree-toggle">${toggleIcon}</span>
    <span class="tree-icon">📁</span>
    <span class="tree-label">${category.name}</span>
    <div class="tree-actions">
      <button class="tree-action-btn add-subcategory" title="Unterkategorie hinzufügen">+</button>
      <button class="tree-action-btn edit-item" title="Bearbeiten">✏️</button>
      <button class="tree-action-btn delete-item" title="Löschen">🗑️</button>
    </div>
  `;

  // Make category draggable
  makeDraggable(categoryDiv, {
    type: 'category',
    name: category.name,
    id: category.id,
    source: 'tag-tree'
  }, 'category');

  // Kinder-Container (für Unterkategorien)
  const childrenDiv = document.createElement('div');
  childrenDiv.className = 'tree-children';
  childrenDiv.style.display = hasSubcategories ? 'block' : 'none';

  if (category.subcategories) {
    category.subcategories.forEach(subcategory => {
      const subElement = createTreeSubcategoryElement(category.id, subcategory);
      childrenDiv.appendChild(subElement);
    });
  }

  // Zusammenbauen
  categoryContainer.appendChild(categoryDiv);
  categoryContainer.appendChild(childrenDiv);

  return categoryContainer;
}

function createTreeSubcategoryElement(categoryId, subcategory) {
  // Haupt-Container für die gesamte Unterkategorie
  const subcategoryContainer = document.createElement('div');
  subcategoryContainer.className = 'subcategory-container';

  // Unterkategorie-Item (die Zeile mit dem Namen)
  const subcategoryDiv = document.createElement('div');
  subcategoryDiv.className = 'tree-item subcategory';
  subcategoryDiv.dataset.type = 'subcategory';
  subcategoryDiv.dataset.id = subcategory.id;
  subcategoryDiv.dataset.parent = categoryId;

  const hasTags = subcategory.tags && subcategory.tags.length > 0;
  const toggleIcon = hasTags ? '▼' : '▶';

  subcategoryDiv.innerHTML = `
    <span class="tree-toggle">${toggleIcon}</span>
    <span class="tree-icon">📂</span>
    <span class="tree-label">${subcategory.name}</span>
    <div class="tree-actions">
      <button class="tree-action-btn add-tag" title="Tag hinzufügen">🏷️</button>
      <button class="tree-action-btn edit-item" title="Bearbeiten">✏️</button>
      <button class="tree-action-btn delete-item" title="Löschen">🗑️</button>
    </div>
  `;

  // Kinder-Container (für Tags)
  const childrenDiv = document.createElement('div');
  childrenDiv.className = 'tree-children';
  childrenDiv.style.display = hasTags ? 'block' : 'none';

  if (subcategory.tags) {
    subcategory.tags.forEach(tagName => {
      const tagElement = createTreeTagElement(categoryId, subcategory.id, tagName);
      childrenDiv.appendChild(tagElement);
    });
  }

  // Zusammenbauen
  subcategoryContainer.appendChild(subcategoryDiv);
  subcategoryContainer.appendChild(childrenDiv);

  return subcategoryContainer;
}

function createTreeTagElement(categoryId, subcategoryId, tagName) {
  const tagDiv = document.createElement('div');
  tagDiv.className = 'tree-item tag draggable';
  tagDiv.dataset.type = 'tag';
  tagDiv.dataset.id = tagName;
  tagDiv.dataset.parent = categoryId;
  tagDiv.dataset.subcategory = subcategoryId;

  // Make tag draggable with new system
  makeDraggable(tagDiv, {
    type: 'tag',
    name: tagName,
    categoryId: categoryId,
    subcategoryId: subcategoryId,
    source: 'tag-tree'
  }, 'tag');

  tagDiv.innerHTML = `
    <span class="tree-icon">🏷️</span>
    <span class="tree-label">${tagName}</span>
    <div class="tree-actions">
      <button class="tree-action-btn edit-item" title="Bearbeiten">✏️</button>
      <button class="tree-action-btn delete-item" title="Löschen">🗑️</button>
    </div>
  `;

  // Drag Event Listeners
  tagDiv.addEventListener('dragstart', handleTagDragStart);
  tagDiv.addEventListener('dragend', handleTagDragEnd);

  return tagDiv;
}



// Drag & Drop System für Tags
let draggedTag = null;

function handleTagDragStart(event) {
  const tagElement = event.target.closest('.tree-item.tag');
  if (!tagElement) return;

  draggedTag = {
    name: tagElement.dataset.tagName,
    categoryId: tagElement.dataset.categoryId,
    subcategoryId: tagElement.dataset.subcategoryId,
    element: tagElement
  };

  // Visual feedback
  tagElement.classList.add('dragging');

  // Set drag data
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', draggedTag.name);
  event.dataTransfer.setData('application/json', JSON.stringify(draggedTag));

  console.log(`🏷️ Drag gestartet für Tag: ${draggedTag.name}`);
}

function handleTagDragEnd(event) {
  const tagElement = event.target.closest('.tree-item.tag');
  if (tagElement) {
    tagElement.classList.remove('dragging');
  }

  // Clear drag state
  draggedTag = null;

  // Remove all drop indicators
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.remove('drag-over', 'drop-target');
  });

  console.log('🏷️ Drag beendet');
}

// Tag auf Datei anwenden
async function applyTagToFile(file, tagName) {
  try {
    // Stelle sicher, dass file.tags ein Array ist
    if (!Array.isArray(file.tags)) {
      file.tags = [];
    }

    // Prüfe ob Tag bereits vorhanden ist
    if (file.tags.includes(tagName)) {
      updateStatus(`Tag "${tagName}" bereits vorhanden bei ${file.name}`);
      return;
    }

    // Tag hinzufügen
    file.tags.push(tagName);

    // Speichere Tag mit mehreren Methoden für maximale Kompatibilität
    let saveSuccess = false;

    // Methode 1: Versuche neue Metadaten-API
    try {
      if (window.electronAPI?.metadata?.writeTags) {
        await window.electronAPI.metadata.writeTags(file.path, file.tags);
        console.log(`💾 Tag "${tagName}" via Metadaten-API gespeichert für ${file.name}`);
        saveSuccess = true;
      }
    } catch (apiError) {
      console.warn(`⚠️ Metadaten-API Speicher-Fehler für ${file.name}:`, apiError);
    }

    // Methode 2: Immer auch in localStorage speichern (als Backup)
    try {
      localStorage.setItem(`tags_${file.path}`, JSON.stringify(file.tags));
      console.log(`💾 Tag "${tagName}" in localStorage gespeichert für ${file.name}`);
      saveSuccess = true;
    } catch (localError) {
      console.warn(`⚠️ LocalStorage Speicher-Fehler für ${file.name}:`, localError);
    }

    if (!saveSuccess) {
      console.error(`❌ Konnte Tag "${tagName}" für ${file.name} nicht speichern!`);
      updateStatus(`Fehler beim Speichern des Tags`);
      return;
    }

    // UI aktualisieren
    updateStatus(`Tag "${tagName}" zu ${file.name} hinzugefügt`);

    // Wenn die Datei aktuell ausgewählt ist, Tags-Anzeige aktualisieren
    if (selectedFiles.length > 0 && selectedFiles[0] && selectedFiles[0].path === file.path) {
      updateCurrentTags(file.tags);
    }

    // Update file grid to show new tag count
    renderFileGrid();

    console.log(`✅ Tag "${tagName}" erfolgreich zu "${file.name}" hinzugefügt`);
  } catch (error) {
    console.error('❌ Fehler beim Anwenden des Tags:', error);
    updateStatus(`Fehler beim Anwenden des Tags: ${error.message}`);
  }
}

// Erstelle hierarchischen Tag aus Namen
function createHierarchicalTagFromName(tagName) {
  // Versuche Tag in der Hierarchie zu finden
  for (const category of tagHierarchy.categories) {
    for (const subcategory of category.subcategories) {
      if (subcategory.tags.includes(tagName)) {
        return {
          category: category.name,
          subcategory: subcategory.name,
          tag: tagName,
          fullPath: `${category.name}/${subcategory.name}/${tagName}`
        };
      }
    }
  }

  // Fallback: Erstelle einfachen Tag
  return {
    category: 'Allgemein',
    subcategory: null,
    tag: tagName,
    fullPath: `Allgemein/${tagName}`
  };
}

// Tag auf mehrere Dateien anwenden (Batch-Tagging)
async function applyTagToMultipleFiles(files, tagName) {
  let successCount = 0;
  let errorCount = 0;

  updateStatus(`Wende Tag "${tagName}" auf ${files.length} Dateien an...`);

  for (const file of files) {
    try {
      if (file.type !== 'directory') {
        // Stelle sicher, dass file.tags ein Array ist
        if (!Array.isArray(file.tags)) {
          file.tags = [];
        }

        // Prüfe ob Tag bereits vorhanden ist
        if (!file.tags.includes(tagName)) {
          // Tag hinzufügen
          file.tags.push(tagName);

          // Metadaten speichern (falls API verfügbar)
          if (window.electronAPI && window.electronAPI.metadata) {
            try {
              await window.electronAPI.metadata.writeTags(file.path, file.tags);
            } catch (error) {
              console.warn(`⚠️ Fehler beim Speichern der Metadaten für ${file.name}:`, error);
            }
          }

          successCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Fehler beim Anwenden des Tags auf ${file.name}:`, error);
      errorCount++;
    }
  }

  // Status-Update
  if (errorCount === 0) {
    updateStatus(`✅ Tag "${tagName}" erfolgreich auf ${successCount} Dateien angewendet`);
    console.log(`✅ Batch-Tagging erfolgreich: ${successCount} Dateien getaggt`);
  } else {
    updateStatus(`⚠️ Tag "${tagName}" auf ${successCount} Dateien angewendet, ${errorCount} Fehler`);
    console.warn(`⚠️ Batch-Tagging teilweise erfolgreich: ${successCount} erfolgreich, ${errorCount} Fehler`);
  }

  // UI aktualisieren wenn eine der Dateien aktuell ausgewählt ist
  if (selectedFiles.length === 1) {
    const selectedFile = selectedFiles[0];
    const updatedFile = files.find(f => f.path === selectedFile.path);
    if (updatedFile) {
      updateCurrentTags(updatedFile.tags);
    }
  }
}

// Visuelles Feedback für angewendete Tags
function showTagAppliedFeedback(fileElement, tagName) {
  // Erstelle Feedback-Element
  const feedback = document.createElement('div');
  feedback.className = 'tag-applied-feedback';
  feedback.textContent = `+${tagName}`;
  feedback.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #4CAF50;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    z-index: 1000;
    pointer-events: none;
    animation: tagFeedback 2s ease-out forwards;
  `;

  // Positioniere relativ zum File-Element
  fileElement.style.position = 'relative';
  fileElement.appendChild(feedback);

  // Entferne nach Animation
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 2000);
}

// Setup Drag & Drop System
function setupDragAndDrop() {
  console.log('🎯 Richte Drag & Drop System ein...');

  // Verhindere Standard-Drag-Verhalten für das gesamte Dokument
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
}

// Setup Keyboard Shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Nur wenn kein Input-Feld fokussiert ist
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl+A: Alle Dateien auswählen
    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      selectAllFiles();
    }

    // Escape: Auswahl aufheben
    if (event.key === 'Escape') {
      event.preventDefault();
      clearSelection();
      updateSelectionUI();
    }

    // Delete: Ausgewählte Dateien löschen (später implementieren)
    if (event.key === 'Delete' && selectedFiles.length > 0) {
      event.preventDefault();
      console.log('🗑️ Delete-Taste gedrückt für', selectedFiles.length, 'Dateien');
      // TODO: Implementiere Lösch-Dialog
    }
  });

  // AGGRESSIVE: Verhindere Text-Selektion im File Grid
  const fileGrid = document.getElementById('fileGrid');
  if (fileGrid) {
    // Verhindere alle Selection-Events
    fileGrid.addEventListener('selectstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    });

    fileGrid.addEventListener('dragstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    });

    // Verhindere Mouse-Selection
    fileGrid.addEventListener('mousedown', (event) => {
      if (event.detail > 1) { // Multi-click
        event.preventDefault();
        event.stopPropagation();
      }
    });

    // Verhindere Context-Menu Selection
    fileGrid.addEventListener('contextmenu', (event) => {
      // Erlaube Context-Menu, aber verhindere Selection
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    });
  }
}

// Alle Dateien auswählen
function selectAllFiles() {
  clearSelection();

  const fileItems = document.querySelectorAll('.file-item');
  fileItems.forEach((element, index) => {
    const file = allFiles[index];
    if (file && file.type !== 'directory') {
      selectedFiles.push(file);
      selectedFileElements.push(element);
      element.classList.add('selected');
    }
  });

  updateSelectionUI();
  console.log(`📁 Alle ${selectedFiles.length} Dateien ausgewählt`);
}

// Gemeinsame Tags von mehreren Dateien finden
function getCommonTags(files) {
  if (files.length === 0) return [];

  // Starte mit den Tags der ersten Datei
  let commonTags = [...(files[0].tags || [])];

  // Filtere Tags, die in allen Dateien vorhanden sind
  for (let i = 1; i < files.length; i++) {
    const fileTags = files[i].tags || [];
    commonTags = commonTags.filter(tag => fileTags.includes(tag));
  }

  return commonTags;
}

// Initialize App
async function initializeApp() {
  console.log('🚀 Initialisiere TagFusion...');

  // Create empty data files on first run
  await portableData.createEmptyDataFiles();

  await initializeTheme();
  await loadSettings();

  // Set language from settings
  currentLanguage = appSettings.language;
  applyTranslations();

  await loadFavorites();
  await loadTagHierarchy();
  setupEventListeners();
  setupDragAndDrop();

  // Initialize grid view as default
  const fileGrid = document.getElementById('fileGrid');
  fileGrid.classList.add('grid-view');

  // Debug: Log grid properties
  console.log('🔧 Grid initialisiert:', {
    classList: fileGrid.classList.toString(),
    computedStyle: window.getComputedStyle(fileGrid).gridTemplateColumns,
    width: fileGrid.offsetWidth
  });

  // Apply settings to app
  applySettingsToApp();

  // Start system monitoring
  startSystemMonitoring();

  await loadDrives();

  // Initialize drag and drop system
  initializeDragAndDrop();

  // Initialize panel resizing
  initializePanelResizing();

  // Show drive overview by default
  showDriveOverview();

  console.log('✅ TagFusion erfolgreich initialisiert');
}

// Custom Dialog System
function showDialog(title, message, placeholder = '', showInput = true) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('dialogOverlay');
    const titleEl = document.getElementById('dialogTitle');
    const messageEl = document.getElementById('dialogMessage');
    const inputEl = document.getElementById('dialogInput');
    const confirmBtn = document.getElementById('dialogConfirm');
    const cancelBtn = document.getElementById('dialogCancel');
    const closeBtn = document.getElementById('dialogClose');

    // Setup dialog
    titleEl.textContent = title;
    messageEl.textContent = message;
    inputEl.placeholder = placeholder;
    inputEl.value = '';
    inputEl.style.display = showInput ? 'block' : 'none';

    // Show dialog
    overlay.style.display = 'flex';
    if (showInput) {
      inputEl.focus();
    }

    // Event handlers
    const handleConfirm = () => {
      const value = showInput ? inputEl.value.trim() : true;
      cleanup();
      resolve(value);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    const cleanup = () => {
      overlay.style.display = 'none';
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      closeBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyPress);
    };

    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyPress);
  });
}

function showConfirm(title, message) {
  return showDialog(title, message, '', false);
}

// Tag Hierarchy CRUD Functions
async function addCategory() {
  const name = await showDialog('Neue Kategorie', 'Name der neuen Kategorie:', 'z.B. Orte, Personen, Ereignisse');
  if (!name || name.trim() === '') return;

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Prüfe ob ID bereits existiert
  if (tagHierarchy.categories.some(cat => cat.id === id)) {
    await showDialog('Fehler', 'Eine Kategorie mit diesem Namen existiert bereits!', '', false);
    return;
  }

  tagHierarchy.categories.push({
    id: id,
    name: name.trim(),
    subcategories: []
  });

  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus(`Kategorie "${name}" hinzugefügt`);
}

async function deleteCategory(categoryId) {
  const confirmed = await showConfirm('Kategorie löschen', 'Kategorie wirklich löschen? Alle Unterkategorien und Tags gehen verloren!');
  if (!confirmed) return;

  tagHierarchy.categories = tagHierarchy.categories.filter(cat => cat.id !== categoryId);
  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus('Kategorie gelöscht');
}

async function addSubcategory(categoryId) {
  console.log(`➕ addSubcategory aufgerufen für Kategorie: ${categoryId}`);

  const name = await showDialog('Neue Unterkategorie', 'Name der neuen Unterkategorie:', 'z.B. Europa, Familie, Urlaub');
  if (!name || name.trim() === '') {
    console.log('❌ Kein Name eingegeben');
    return;
  }

  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) {
    console.error(`❌ Kategorie ${categoryId} nicht gefunden!`);
    return;
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  console.log(`🆔 Generierte ID: ${id}`);

  // Prüfe ob ID bereits existiert
  if (category.subcategories.some(sub => sub.id === id)) {
    await showDialog('Fehler', 'Eine Unterkategorie mit diesem Namen existiert bereits!', '', false);
    return;
  }

  category.subcategories.push({
    id: id,
    name: name.trim(),
    tags: []
  });

  console.log(`✅ Unterkategorie "${name}" zu Kategorie "${category.name}" hinzugefügt`);
  console.log('💾 Speichere und rendere neu...');

  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus(`Unterkategorie "${name}" hinzugefügt`);
}

async function deleteSubcategory(categoryId, subcategoryId) {
  const confirmed = await showConfirm('Unterkategorie löschen', 'Unterkategorie wirklich löschen? Alle Tags gehen verloren!');
  if (!confirmed) return;

  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  category.subcategories = category.subcategories.filter(sub => sub.id !== subcategoryId);
  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus('Unterkategorie gelöscht');
}

async function addTagToSubcategory(categoryId, subcategoryId) {
  const name = await showDialog('Neuer Tag', 'Name des neuen Tags:', 'z.B. Deutschland, Familie, Weihnachten');
  if (!name || name.trim() === '') return;

  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
  if (!subcategory) return;

  const tagName = name.trim();

  // Prüfe ob Tag bereits existiert
  if (subcategory.tags.includes(tagName)) {
    await showDialog('Fehler', 'Dieser Tag existiert bereits in dieser Unterkategorie!', '', false);
    return;
  }

  subcategory.tags.push(tagName);
  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus(`Tag "${tagName}" hinzugefügt`);
}

async function deleteTag(categoryId, subcategoryId, tagName) {
  const confirmed = await showConfirm('Tag löschen', `Tag "${tagName}" wirklich löschen?`);
  if (!confirmed) return;

  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
  if (!subcategory) return;

  subcategory.tags = subcategory.tags.filter(tag => tag !== tagName);
  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus(`Tag "${tagName}" gelöscht`);
}

// Edit Functions
async function editCategory(categoryId) {
  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  const newName = await showDialog('Kategorie bearbeiten', 'Neuer Name:', category.name);
  if (!newName || newName.trim() === '') return;

  category.name = newName.trim();
  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus(`Kategorie zu "${newName}" geändert`);
}

async function editSubcategory(categoryId, subcategoryId) {
  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
  if (!subcategory) return;

  const newName = await showDialog('Unterkategorie bearbeiten', 'Neuer Name:', subcategory.name);
  if (!newName || newName.trim() === '') return;

  subcategory.name = newName.trim();
  saveTagHierarchy();
  renderTagHierarchy();
  updateStatus(`Unterkategorie zu "${newName}" geändert`);
}

async function editTag(categoryId, subcategoryId, oldTagName) {
  const category = tagHierarchy.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
  if (!subcategory) return;

  const newName = await showDialog('Tag bearbeiten', 'Neuer Name:', oldTagName);
  if (!newName || newName.trim() === '') return;

  const tagIndex = subcategory.tags.indexOf(oldTagName);
  if (tagIndex !== -1) {
    subcategory.tags[tagIndex] = newName.trim();
    saveTagHierarchy();
    renderTagHierarchy();
    updateStatus(`Tag zu "${newName}" geändert`);
  }
}

function applyTag(tagName) {
  if (selectedFiles.length === 0) {
    updateStatus('Keine Datei ausgewählt');
    return;
  }

  if (!currentFileTags.includes(tagName)) {
    currentFileTags.push(tagName);
    selectedFiles[0].tags = [...currentFileTags];
    updateCurrentTags(currentFileTags);
    saveFileTags(selectedFiles[0]);
    updateStatus(`Tag "${tagName}" angewendet`);
  } else {
    updateStatus(`Tag "${tagName}" bereits vorhanden`);
  }
}

// Event Listeners
function setupEventListeners() {
  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Settings button
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsDialog);
  }

  // Search functionality
  searchInput.addEventListener('input', handleSearch);

  // View controls
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', handleViewChange);
  });

  // Filter controls
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', handleFilterChange);
  });

  // Tag input
  tagInput.addEventListener('keypress', handleTagInput);
  document.querySelector('.tag-add-btn').addEventListener('click', addTag);

  // Save Tags Button
  const saveTagsBtn = document.getElementById('saveTagsBtn');
  if (saveTagsBtn) {
    saveTagsBtn.addEventListener('click', async () => {
      if (selectedFiles.length > 0) {
        await saveFileTags(selectedFiles[0]);
      } else {
        updateStatus('Keine Datei ausgewählt');
      }
    });
  }

  // Favorites
  const addFavoriteBtn = document.getElementById('addFavoriteBtn');
  if (addFavoriteBtn) {
    addFavoriteBtn.addEventListener('click', addToFavorites);
  }

  // Favorites import/export menu
  const favoritesMenuBtn = document.getElementById('favoritesMenuBtn');
  if (favoritesMenuBtn) {
    favoritesMenuBtn.addEventListener('click', showFavoritesImportExportMenu);
  }

  // Tag Hierarchy
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', addCategory);
  }

  // Tag hierarchy import/export menu
  const tagHierarchyMenuBtn = document.getElementById('tagHierarchyMenuBtn');
  if (tagHierarchyMenuBtn) {
    tagHierarchyMenuBtn.addEventListener('click', showTagHierarchyImportExportMenu);
  }

  // Tree items and actions
  setupTreeEventListeners();

  // Keyboard shortcuts
  setupKeyboardShortcuts();

  // Rating section event listeners
  setupRatingEventListeners();

  // Grid size slider event listeners
  setupGridSizeSlider();

  // Default favorites event listeners
  setupDefaultFavoritesEventListeners();

  console.log('📡 Event Listeners eingerichtet');
}

// Setup rating event listeners
function setupRatingEventListeners() {
  const ratingStars = document.getElementById('ratingStars');
  const clearRatingBtn = document.getElementById('clearRating');

  if (ratingStars) {
    ratingStars.addEventListener('click', (e) => {
      if (e.target.classList.contains('star')) {
        const rating = parseInt(e.target.dataset.rating);
        setFileRating(rating);
      }
    });

    // Hover effects
    ratingStars.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('star')) {
        const hoverRating = parseInt(e.target.dataset.rating);
        const stars = ratingStars.querySelectorAll('.star');
        stars.forEach((star, index) => {
          const starRating = index + 1;
          star.style.color = starRating <= hoverRating ? '#FFD700' : '#ddd';
        });
      }
    });

    ratingStars.addEventListener('mouseleave', () => {
      // Reset to actual rating
      const ratingSection = document.getElementById('ratingSection');
      if (ratingSection && ratingSection.dataset.filePath) {
        const filePath = ratingSection.dataset.filePath;
        const file = allFiles.find(f => f.path === filePath);
        if (file) {
          updateRatingSection(file);
        }
      }
    });
  }

  if (clearRatingBtn) {
    clearRatingBtn.addEventListener('click', clearFileRating);
  }
}

// Setup grid size slider
function setupGridSizeSlider() {
  const gridSizeSlider = document.getElementById('gridSizeSlider');
  const gridSizeValue = document.getElementById('gridSizeValue');

  if (!gridSizeSlider || !gridSizeValue) return;

  // Update grid size on slider change
  gridSizeSlider.addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    updateGridSize(size);
    gridSizeValue.textContent = `${size}px`;
  });

  // Initialize with current value
  const initialSize = parseInt(gridSizeSlider.value);
  updateGridSize(initialSize);
  gridSizeValue.textContent = `${initialSize}px`;
}

// Update grid size
function updateGridSize(size) {
  const fileGrid = document.getElementById('fileGrid');
  if (!fileGrid) return;

  // Update CSS custom property for grid size
  document.documentElement.style.setProperty('--grid-item-size', `${size}px`);

  // Update grid template columns with !important to override CSS
  if (fileGrid.classList.contains('grid-view')) {
    fileGrid.style.setProperty('grid-template-columns', `repeat(auto-fill, minmax(${size}px, 1fr))`, 'important');
  }

  console.log(`📏 Grid-Größe geändert: ${size}px`);
}

// Setup default favorites event listeners
function setupDefaultFavoritesEventListeners() {
  console.log('🔧 Richte Default-Favoriten Event Listeners ein...');

  const defaultFavorites = document.querySelectorAll('.default-favorite');
  console.log(`🔍 Gefundene Default-Favoriten: ${defaultFavorites.length}`);

  defaultFavorites.forEach((favorite, index) => {
    const path = favorite.dataset.path;
    console.log(`📋 Registriere Event-Listener für: ${path}`);

    favorite.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log(`🖱️ Default-Favorit geklickt: ${path}`);

      // Entferne aktive Klasse von allen Favoriten
      document.querySelectorAll('.favorite-item').forEach(item => {
        item.classList.remove('active');
      });

      // Setze aktive Klasse auf geklickten Favorit
      favorite.classList.add('active');

      // Hide drive overview and show file grid
      if (driveOverview) driveOverview.style.display = 'none';
      if (fileGrid) {
        fileGrid.style.display = 'block';
        // Stelle sicher, dass Grid-View aktiv ist
        fileGrid.classList.remove('list-view');
        fileGrid.classList.add('grid-view');
      }

      if (path === 'all') {
        // Zeige alle Bilder
        await showAllImages();
      } else if (path === 'recent') {
        // Zeige Bilder der letzten Woche
        await showRecentImages();
      } else if (path === 'rated') {
        // Zeige bewertete Bilder
        await showRatedImages();
      } else if (path === 'tagged') {
        // Zeige getaggte Bilder
        await showTaggedImages();
      } else if (path === 'large') {
        // Zeige große Bilder
        await showLargeImages();
      }
    });

    // Füge Hover-Effekt hinzu
    favorite.addEventListener('mouseenter', () => {
      favorite.style.backgroundColor = 'var(--hover-color, #f0f0f0)';
    });

    favorite.addEventListener('mouseleave', () => {
      if (!favorite.classList.contains('active')) {
        favorite.style.backgroundColor = '';
      }
    });
  });

  console.log('✅ Default-Favoriten Event Listeners eingerichtet');
}

// Show all images from common image directories
async function showAllImages() {
  console.log('📁 Zeige alle Bilder...');

  try {
    // Clear current directory
    currentDirectory = null;
    allFiles = [];
    filteredFiles = [];

    updateStatus('Lade alle Bilder...');
    updateBreadcrumb('Alle Bilder');

    // Common image directories to scan
    const commonImageDirs = [
      'D:\\Bilder',
      'C:\\Users\\Public\\Pictures',
      'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\Pictures',
      'E:\\Pictures',
      'F:\\Pictures',
      'G:\\Pictures'
    ];

    let totalImages = 0;

    // Scan common image directories
    for (const dirPath of commonImageDirs) {
      try {
        updateStatus(`Scanne ${dirPath}... (${totalImages} Bilder gefunden)`);

        const directoryContents = await window.electronAPI.fileSystem.getDirectoryContents(dirPath);
        if (directoryContents && directoryContents.files) {
          const imageFiles = directoryContents.files.filter(file =>
            file.type === 'image' && /\.(jpg|jpeg|png|gif|bmp|webp|tiff|svg)$/i.test(file.name)
          );

          // Lade Tags für die ersten 50 Bilder sofort
          const firstBatch = imageFiles.slice(0, 50);
          for (const file of firstBatch) {
            await loadFileTags(file);
          }

          allFiles.push(...imageFiles);
          totalImages += imageFiles.length;

          // Zeige sofort die ersten gefundenen Bilder
          if (totalImages > 0 && filteredFiles.length === 0) {
            filteredFiles = [...allFiles];
            renderFileGrid(filteredFiles);
            updateFileCount(filteredFiles.length);
          }

          console.log(`📊 ${imageFiles.length} Bilder in ${dirPath} gefunden`);
        }

      } catch (error) {
        // Ordner existiert nicht oder ist nicht zugänglich - das ist normal
        console.log(`ℹ️ Ordner nicht verfügbar: ${dirPath}`);
      }
    }

    // Finale Aktualisierung
    filteredFiles = [...allFiles];
    renderFileGrid(filteredFiles);
    updateFileCount(filteredFiles.length);

    if (filteredFiles.length > 0) {
      updateStatus(`${filteredFiles.length} Bilder aus Bild-Ordnern geladen`);
      console.log(`✅ Alle Bilder geladen: ${filteredFiles.length} Dateien`);
    } else {
      updateStatus('Keine Bilder in den Standard-Ordnern gefunden');
      console.log('ℹ️ Keine Bilder gefunden. Versuche andere Ordner zu öffnen.');
    }

  } catch (error) {
    console.error('❌ Fehler beim Laden aller Bilder:', error);
    updateStatus('Fehler beim Laden aller Bilder');
  }
}

// Show recent images (last 7 days)
async function showRecentImages() {
  console.log('📅 Zeige Bilder der letzten Woche...');

  try {
    // Clear current directory
    currentDirectory = null;
    allFiles = [];
    filteredFiles = [];

    // Get all drives and scan for recent images
    if (availableDrives.length === 0) {
      await loadDrives();
    }

    updateStatus('Lade aktuelle Bilder...');
    updateBreadcrumb('Letzte Woche');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log(`📅 Suche nach Bildern seit: ${oneWeekAgo.toLocaleDateString()}`);

    let totalRecentImages = 0;

    // Scan all drives for recent images
    for (const drive of availableDrives) {
      try {
        updateStatus(`Scanne ${drive.name} nach aktuellen Bildern... (${totalRecentImages} gefunden)`);

        const directoryContents = await window.electronAPI.fileSystem.getDirectoryContents(drive.path);
        const files = directoryContents.files || [];
        const recentImageFiles = files.filter(file => {
          const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff|svg)$/i.test(file.name);
          const isRecent = new Date(file.modified) >= oneWeekAgo;
          return isImage && isRecent;
        });

        // Lade Tags für jede aktuelle Bilddatei
        for (const file of recentImageFiles) {
          await loadFileTags(file);
        }

        allFiles.push(...recentImageFiles);
        totalRecentImages += recentImageFiles.length;

        console.log(`📊 ${recentImageFiles.length} aktuelle Bilder in ${drive.name} gefunden`);

      } catch (error) {
        console.warn(`⚠️ Fehler beim Scannen von ${drive.path}:`, error);
      }
    }

    // Sort by modification date (newest first)
    allFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    filteredFiles = [...allFiles];
    renderFileGrid(filteredFiles);
    updateFileCount(filteredFiles.length);
    updateStatus(`${filteredFiles.length} aktuelle Bilder der letzten Woche gefunden`);

    console.log(`✅ Aktuelle Bilder geladen: ${filteredFiles.length} Dateien`);

  } catch (error) {
    console.error('❌ Fehler beim Laden aktueller Bilder:', error);
    updateStatus('Fehler beim Laden aktueller Bilder');
  }
}

// Setup Tree Event Listeners
function setupTreeEventListeners() {
  console.log('🔧 Richte Tree Event Listeners ein...');

  // Tree item clicks (toggle expand/collapse)
  const toggles = document.querySelectorAll('.tree-item .tree-toggle');
  console.log(`🔄 Gefunden ${toggles.length} Toggle-Buttons`);
  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const treeItem = e.target.closest('.tree-item');
      const children = treeItem.querySelector('.tree-children');
      if (children) {
        const isExpanded = toggle.textContent === '▼';
        toggle.textContent = isExpanded ? '▶' : '▼';
        children.style.display = isExpanded ? 'none' : 'block';
        console.log(`🔄 Toggle: ${isExpanded ? 'Eingeklappt' : 'Ausgeklappt'}`);
      }
    });
  });

  // Add subcategory buttons
  const addSubcategoryBtns = document.querySelectorAll('.add-subcategory');
  console.log(`➕ Gefunden ${addSubcategoryBtns.length} Add-Subcategory-Buttons`);
  addSubcategoryBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const treeItem = e.target.closest('.tree-item');
      const categoryId = treeItem.dataset.id;
      console.log(`➕ Füge Unterkategorie zu ${categoryId} hinzu`);
      addSubcategory(categoryId);
    });
  });

  // Add tag buttons
  document.querySelectorAll('.add-tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const treeItem = e.target.closest('.tree-item');
      const subcategoryId = treeItem.dataset.id;
      const categoryId = treeItem.dataset.parent;
      addTagToSubcategory(categoryId, subcategoryId);
    });
  });

  // Edit buttons
  document.querySelectorAll('.edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const treeItem = e.target.closest('.tree-item');
      const type = treeItem.dataset.type;
      const id = treeItem.dataset.id;
      const parent = treeItem.dataset.parent;

      if (type === 'category') {
        editCategory(id);
      } else if (type === 'subcategory') {
        editSubcategory(parent, id);
      } else if (type === 'tag') {
        editTag(parent, treeItem.closest('.subcategory').dataset.id, id);
      }
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const treeItem = e.target.closest('.tree-item');
      const type = treeItem.dataset.type;
      const id = treeItem.dataset.id;
      const parent = treeItem.dataset.parent;

      if (type === 'category') {
        deleteCategory(id);
      } else if (type === 'subcategory') {
        deleteSubcategory(parent, id);
      } else if (type === 'tag') {
        const tagName = treeItem.querySelector('.tree-label').textContent;
        deleteTag(parent, treeItem.closest('.subcategory').dataset.id, tagName);
      }
    });
  });

  // Tag clicks (apply to selected files)
  document.querySelectorAll('.tree-item.tag').forEach(tagItem => {
    tagItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('tree-action-btn')) return; // Don't apply tag if clicking action button

      const tagName = tagItem.querySelector('.tree-label').textContent;
      applyTag(tagName);
    });
  });
}

// Search Handler
function handleSearch(event) {
  const query = event.target.value.toLowerCase();
  console.log('🔍 Suche:', query);
  
  if (query === '') {
    renderFileGrid();
    return;
  }
  
  const filteredFiles = allFiles.filter(file => 
    file.name.toLowerCase().includes(query) ||
    file.tags.some(tag => tag.toLowerCase().includes(query))
  );
  
  renderFileGrid(filteredFiles);
  updateStatus(`${filteredFiles.length} Dateien gefunden`);
}

// View Change Handler
function handleViewChange(event) {
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  const view = event.target.dataset.view;
  const fileGrid = document.getElementById('fileGrid');

  // Remove existing view classes
  fileGrid.classList.remove('grid-view', 'list-view');

  // Add new view class
  fileGrid.classList.add(`${view}-view`);

  console.log('👁️ Ansicht geändert:', view);
  updateStatus(`Ansicht geändert zu: ${view === 'grid' ? 'Raster' : 'Liste'}`);
}

// Tree Item Click Handler
function handleTreeItemClick(event) {
  const item = event.currentTarget;
  const toggle = item.querySelector('.tree-toggle');
  const label = item.querySelector('.tree-label').textContent;
  
  console.log('🌳 Tree Item geklickt:', label);
  
  // Toggle expanded state
  if (toggle.textContent === '▶') {
    toggle.textContent = '▼';
    // Hier würden Unterelemente angezeigt
  } else {
    toggle.textContent = '▶';
    // Hier würden Unterelemente versteckt
  }
  
  updateStatus(`Filter: ${label}`);
}

// ===== FILTER SYSTEM =====

// Apply current filter to files
function applyFilter(filter = currentFilter) {
  currentFilter = filter;

  switch (filter) {
    case 'all':
      filteredFiles = [...allFiles];
      break;
    case 'images':
      filteredFiles = allFiles.filter(file => file.type === 'image');
      break;
    case 'videos':
      filteredFiles = allFiles.filter(file => file.type === 'video');
      break;
    case 'folders':
      filteredFiles = allFiles.filter(file => file.type === 'directory');
      break;
    case 'tagged':
      filteredFiles = allFiles.filter(file => file.tags && file.tags.length > 0);
      break;
    case 'rated':
      filteredFiles = allFiles.filter(file => file.rating && file.rating > 0);
      break;
    default:
      filteredFiles = [...allFiles];
  }

  // Update filter button states
  updateFilterButtons();

  // Re-render grid with filtered files
  renderFileGrid(filteredFiles);

  // Update file count
  updateFileCount(filteredFiles.length);

  console.log(`🔍 Filter "${filter}" angewendet: ${filteredFiles.length}/${allFiles.length} Dateien`);
}

// Update filter button states
function updateFilterButtons() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });
}

// Handle filter change
function handleFilterChange(event) {
  const filter = event.target.dataset.filter;
  if (filter) {
    applyFilter(filter);
    updateStatus(`Filter: ${getFilterDisplayName(filter)}`);
  }
}

// Get display name for filter
function getFilterDisplayName(filter) {
  const names = {
    'all': 'Alle Dateien',
    'images': 'Nur Bilder',
    'videos': 'Nur Videos',
    'folders': 'Nur Ordner',
    'tagged': 'Nur getaggte Dateien',
    'rated': 'Nur bewertete Dateien'
  };
  return names[filter] || filter;
}

// File Grid Rendering
function renderFileGrid(files = allFiles) {
  performance.mark('renderFileGrid-start');

  fileGrid.innerHTML = '';

  // Debug: Log grid state
  console.log('🔧 Rendering Grid:', {
    fileCount: files.length,
    gridClasses: fileGrid.classList.toString(),
    gridWidth: fileGrid.offsetWidth,
    computedColumns: window.getComputedStyle(fileGrid).gridTemplateColumns
  });

  if (files.length === 0) {
    fileGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <div class="empty-text">Keine Bilder gefunden</div>
        <div class="empty-hint">Wähle einen Ordner mit Bildern aus</div>
      </div>
    `;
    performance.mark('renderFileGrid-end');
    performance.measure('renderFileGrid', 'renderFileGrid-start', 'renderFileGrid-end');
    return;
  }

  files.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.index = index;
    fileItem.dataset.path = file.path;
    fileItem.dataset.type = file.type;

    // Erstelle Thumbnail
    const thumbnail = createThumbnail(file);

    // Bestimme Dateityp-Anzeige
    let fileTypeDisplay = '';
    switch (file.type) {
      case 'directory':
        fileTypeDisplay = 'ORDNER';
        break;
      case 'video':
        fileTypeDisplay = file.extension ? file.extension.toUpperCase() : 'VIDEO';
        break;
      case 'image':
        fileTypeDisplay = file.extension ? file.extension.toUpperCase() : 'BILD';
        break;
      default:
        fileTypeDisplay = file.extension ? file.extension.toUpperCase() : 'DATEI';
    }

    // Generate rating stars for display
    const ratingStars = generateRatingStars(file.rating || 0, false);

    // Generate tag count display
    const tagCount = file.tags ? file.tags.length : 0;
    const tagCountDisplay = tagCount > 0 ?
      `<div class="file-tag-count" data-count="${tagCount}" title="${tagCount} Tag${tagCount !== 1 ? 's' : ''}: ${file.tags.join(', ')}">🏷️ ${tagCount}</div>` : '';

    fileItem.innerHTML = `
      <div class="file-thumbnail">${thumbnail}</div>
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-info">
        <span class="file-size">${formatFileSize(file.size || 0)}</span>
        <span class="file-type">${fileTypeDisplay}</span>
      </div>
      ${(file.type === 'image' || file.type === 'video') && ratingStars ?
        `<div class="file-rating">${ratingStars}</div>` : ''}
      ${tagCountDisplay}
    `;

    // Make file item draggable
    makeDraggable(fileItem, {
      type: 'file',
      name: file.name,
      path: file.path,
      tags: file.tags || [],
      source: 'file-grid'
    }, 'file');

    // Make file item a drop target for tag transfer
    makeDropTarget(fileItem, (data) => {
      if (data.type === 'tag') {
        // Add tag to this file
        addTagToFile(file, data.name);
      } else if (data.type === 'file' && data.path !== file.path) {
        // Transfer tags from dragged file to this file
        transferTagsBetweenFiles(data, file);
      }
    }, ['tag', 'file']);

    fileItem.addEventListener('click', (event) => selectFile(file, fileItem, event));
    fileItem.addEventListener('dblclick', (event) => handleFileDoubleClick(file, event));
    fileItem.addEventListener('contextmenu', (event) => handleFileContextMenu(file, event));

    // Verhindere Text-Selektion
    fileItem.addEventListener('selectstart', (event) => event.preventDefault());
    fileItem.addEventListener('dragstart', (event) => event.preventDefault());

    // Drag & Drop Event Listeners für Dateien
    setupFileDropListeners(fileItem, file);

    fileGrid.appendChild(fileItem);
  });

  performance.mark('renderFileGrid-end');
  performance.measure('renderFileGrid', 'renderFileGrid-start', 'renderFileGrid-end');

  updateFileCount(files.length);

  // Initialisiere Lazy Loading nach dem Rendern
  setTimeout(() => {
    initializeLazyLoading();
  }, 100);
}

// Setup Drop Listeners für einzelne Dateien
function setupFileDropListeners(fileElement, file) {
  fileElement.addEventListener('dragover', (event) => {
    if (draggedTag) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      fileElement.classList.add('drag-over');
    }
  });

  fileElement.addEventListener('dragleave', (event) => {
    // Nur entfernen wenn wir das Element wirklich verlassen
    if (!fileElement.contains(event.relatedTarget)) {
      fileElement.classList.remove('drag-over');
    }
  });

  fileElement.addEventListener('drop', async (event) => {
    event.preventDefault();
    fileElement.classList.remove('drag-over');

    if (draggedTag && file.type !== 'directory') {
      // Speichere Tag-Daten bevor sie durch dragend gelöscht werden
      const tagName = draggedTag.name;
      const tagData = { ...draggedTag };

      // Prüfe ob die Datei Teil einer Mehrfachauswahl ist
      const isPartOfSelection = selectedFiles.some(f => f.path === file.path);

      if (isPartOfSelection && selectedFiles.length > 1) {
        // Batch-Tagging: Tag auf alle ausgewählten Dateien anwenden
        console.log(`🏷️ Batch-Tagging: Tag "${tagName}" auf ${selectedFiles.length} Dateien anwenden`);
        await applyTagToMultipleFiles(selectedFiles, tagName);

        // Visual feedback für alle ausgewählten Dateien
        selectedFileElements.forEach(element => {
          showTagAppliedFeedback(element, tagName);
        });
      } else {
        // Einzelnes Tagging
        console.log(`🏷️ Tag "${tagName}" auf Datei "${file.name}" anwenden`);
        await applyTagToFile(file, tagName);

        // Visual feedback mit gespeicherten Daten
        showTagAppliedFeedback(fileElement, tagName);
      }
    }
  });
}

function createThumbnail(file) {
  switch (file.type) {
    case 'image':
      // Für Bilder: Lazy Loading Placeholder
      return `
        <div class="image-thumbnail loading">
          <div class="thumbnail-placeholder">🖼️</div>
          <img class="thumbnail-image" data-src="${file.path}" alt="${file.name}" style="display: none;">
        </div>
      `;

    case 'video':
      // Für Videos: Lazy Loading Video-Thumbnail
      return `
        <div class="video-thumbnail loading">
          <div class="thumbnail-placeholder">
            <div class="video-icon">🎬</div>
          </div>
          <video class="video-preview" data-src="${file.path}" preload="none" muted style="display: none;">
            <source data-src="file:///${file.path.replace(/\\/g, '/')}#t=1">
          </video>
          <div class="play-button">▶</div>
        </div>
      `;

    case 'directory':
      // Für Ordner: Sofort laden
      return `
        <div class="folder-thumbnail">
          <div class="folder-icon">📁</div>
        </div>
      `;

    default:
      return '📄';
  }
}

// Lazy Loading für Thumbnails
function initializeLazyLoading() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadThumbnail(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '50px'
  });

  // Beobachte alle Thumbnails
  document.querySelectorAll('.file-thumbnail').forEach(thumbnail => {
    observer.observe(thumbnail);
  });
}

function loadThumbnail(thumbnailElement) {
  const imageThumb = thumbnailElement.querySelector('.image-thumbnail');
  const videoThumb = thumbnailElement.querySelector('.video-thumbnail');

  if (imageThumb) {
    loadImageThumbnail(imageThumb);
  } else if (videoThumb) {
    loadVideoThumbnail(videoThumb);
  }
}

function loadImageThumbnail(imageThumb) {
  const img = imageThumb.querySelector('.thumbnail-image');
  const placeholder = imageThumb.querySelector('.thumbnail-placeholder');
  const imagePath = img.dataset.src;

  if (!imagePath) return;

  const safePath = imagePath.replace(/\\/g, '/');
  img.src = `file:///${safePath}`;

  img.onload = () => {
    placeholder.style.display = 'none';
    img.style.display = 'block';
    imageThumb.classList.remove('loading');
  };

  img.onerror = () => {
    placeholder.innerHTML = '❌';
    imageThumb.classList.remove('loading');
  };
}

function loadVideoThumbnail(videoThumb) {
  const video = videoThumb.querySelector('.video-preview');
  const placeholder = videoThumb.querySelector('.thumbnail-placeholder');
  const videoPath = video.dataset.src;

  if (!videoPath) return;

  const safePath = videoPath.replace(/\\/g, '/');
  const source = video.querySelector('source');
  source.src = `file:///${safePath}#t=1`;

  video.load();

  video.onloadeddata = () => {
    video.currentTime = 1; // Springe zu Sekunde 1
  };

  video.onseeked = () => {
    placeholder.style.display = 'none';
    video.style.display = 'block';
    videoThumb.classList.remove('loading');
  };

  video.onerror = () => {
    // Fallback: Behalte Icon
    videoThumb.classList.remove('loading');
  };
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Doppelklick-Handler für Dateien
async function handleFileDoubleClick(file, event) {
  event.preventDefault();
  event.stopPropagation();

  console.log(`🖱️ Doppelklick auf ${file.type}: ${file.name}`);

  if (file.type === 'directory') {
    // Ordner: Navigiere hinein
    await loadDirectory(file.path);
    return;
  }

  if (file.type === 'image') {
    // Bild: Öffne Vollbild-Viewer
    await openFullscreenViewer(file);
  } else if (file.type === 'video') {
    // Video: Öffne Video-Player
    await openVideoPlayer(file);
  } else {
    // Andere Dateien: Versuche mit System-Standard zu öffnen
    try {
      await window.electronAPI?.shell?.openPath(file.path);
      updateStatus(`Datei mit Standard-Programm geöffnet: ${file.name}`);
    } catch (error) {
      console.error('❌ Fehler beim Öffnen der Datei:', error);
      updateStatus(`⚠️ Konnte Datei nicht öffnen: ${file.name}`);
    }
  }
}

// File Selection mit Multi-Selection Support
async function selectFile(file, element, event = null) {
  // Wenn es ein Ordner ist, navigiere hinein (außer bei Multi-Selection)
  if (file.type === 'directory' && !event?.ctrlKey && !event?.shiftKey) {
    await loadDirectory(file.path);
    return;
  }

  const currentIndex = allFiles.indexOf(file);
  const isCtrlClick = event?.ctrlKey || event?.metaKey;
  const isShiftClick = event?.shiftKey;

  if (isShiftClick && lastSelectedIndex >= 0) {
    // Shift+Click: Bereichsauswahl
    selectRange(lastSelectedIndex, currentIndex);
  } else if (isCtrlClick) {
    // Ctrl+Click: Multi-Selection Toggle
    toggleFileSelection(file, element, currentIndex);
  } else {
    // Normale Auswahl: Einzelauswahl
    selectSingle(file, element, currentIndex);
  }

  // Update UI
  updateSelectionUI();
  console.log(`📁 ${selectedFiles.length} Datei(en) ausgewählt`);
}

// Einzelauswahl
function selectSingle(file, element, index) {
  // Clear previous selection
  clearSelection();

  // Select current file
  selectedFiles = [file];
  selectedFileElements = [element];
  lastSelectedIndex = index;

  // Füge selected class hinzu und force repaint
  element.classList.add('selected');
  element.offsetHeight; // Force reflow
}

// Toggle-Auswahl (Ctrl+Click)
function toggleFileSelection(file, element, index) {
  const fileIndex = selectedFiles.findIndex(f => f.path === file.path);

  if (fileIndex >= 0) {
    // Datei ist bereits ausgewählt - entfernen
    selectedFiles.splice(fileIndex, 1);
    selectedFileElements.splice(fileIndex, 1);
    element.classList.remove('selected');
    element.offsetHeight; // Force reflow
  } else {
    // Datei hinzufügen
    selectedFiles.push(file);
    selectedFileElements.push(element);
    element.classList.add('selected');
    element.offsetHeight; // Force reflow
  }

  lastSelectedIndex = index;
}

// Bereichsauswahl (Shift+Click)
function selectRange(startIndex, endIndex) {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  // Clear previous selection
  clearSelection();

  // Select range
  for (let i = start; i <= end; i++) {
    if (i < allFiles.length) {
      const file = allFiles[i];
      const fileElement = findFileElement(file);

      if (fileElement && file.type !== 'directory') {
        selectedFiles.push(file);
        selectedFileElements.push(fileElement);
        fileElement.classList.add('selected');
      }
    }
  }
}

// Hilfsfunktion: Finde DOM-Element für Datei
function findFileElement(file) {
  const fileItems = document.querySelectorAll('.file-item');
  for (let item of fileItems) {
    const fileName = item.querySelector('.file-name')?.textContent;
    if (fileName === file.name) {
      return item;
    }
  }
  return null;
}

// Auswahl löschen
function clearSelection() {
  selectedFileElements.forEach(element => {
    element.classList.remove('selected');
    element.offsetHeight; // Force reflow
  });
  selectedFiles = [];
  selectedFileElements = [];
}

// UI nach Auswahl aktualisieren
async function updateSelectionUI() {
  if (selectedFiles.length === 1) {
    // Einzelauswahl: Zeige Details
    const file = selectedFiles[0];
    await loadFileTags(file);
    updateFileInfo(file);
    updateCurrentTags(file.tags);
    updateStatus(`Ausgewählt: ${file.name}`);
  } else if (selectedFiles.length > 1) {
    // Mehrfachauswahl: Zeige Batch-Info
    const fileCount = selectedFiles.length;
    const imageCount = selectedFiles.filter(f => f.type === 'image').length;
    const videoCount = selectedFiles.filter(f => f.type === 'video').length;

    // Berechne Gesamtgröße
    const totalSize = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

    updateStatus(`${fileCount} Dateien ausgewählt (${imageCount} Bilder, ${videoCount} Videos) - ${formatFileSize(totalSize)}`);
    updateFileInfo(null); // Clear single file info

    // Zeige gemeinsame Tags (falls vorhanden)
    const commonTags = getCommonTags(selectedFiles);
    updateCurrentTags(commonTags);
  } else {
    // Keine Auswahl
    updateStatus('Keine Dateien ausgewählt');
    updateFileInfo(null);
    updateCurrentTags([]);
  }
}

// Lade Tags und Metadaten aus Datei
async function loadFileTags(file) {
  try {
    console.log(`🔍 Lade Tags für: ${file.name}`);

    // Initialisiere mit leeren Werten
    file.tags = [];
    file.rating = 0;

    // Methode 1: Versuche neue Metadaten-API
    try {
      if (window.electronAPI?.metadata?.read) {
        const metadata = await window.electronAPI.metadata.read(file.path);
        if (metadata) {
          // Konvertiere hierarchische Tags zu flacher Liste
          if (metadata.tags && Array.isArray(metadata.tags)) {
            file.tags = metadata.tags.map(tag => {
              if (typeof tag === 'string') return tag;
              return tag.fullPath || tag.tag || tag;
            });
          }
          file.rating = metadata.rating || 0;
          file.dateCreated = metadata.dateCreated;
          file.cameraInfo = metadata.cameraInfo;

          console.log(`✅ Metadaten-API: ${file.tags.length} Tags für ${file.name}`);
          return; // Erfolgreich geladen
        }
      }
    } catch (apiError) {
      console.warn(`⚠️ Metadaten-API Fehler für ${file.name}:`, apiError);
    }

    // Methode 2: Fallback zu alter readTags API
    try {
      if (window.electronAPI?.metadata?.readTags) {
        const tags = await window.electronAPI.metadata.readTags(file.path);
        if (tags && Array.isArray(tags)) {
          file.tags = tags;
          console.log(`✅ ReadTags-API: ${file.tags.length} Tags für ${file.name}`);
          return;
        }
      }
    } catch (readTagsError) {
      console.warn(`⚠️ ReadTags-API Fehler für ${file.name}:`, readTagsError);
    }

    // Methode 3: Fallback zu localStorage
    const localStorageKey = `tags_${file.path}`;
    const storedTags = localStorage.getItem(localStorageKey);
    if (storedTags) {
      try {
        file.tags = JSON.parse(storedTags);
        console.log(`✅ LocalStorage: ${file.tags.length} Tags für ${file.name}`);
      } catch (parseError) {
        console.warn(`⚠️ LocalStorage Parse-Fehler für ${file.name}:`, parseError);
        file.tags = [];
      }
    }

    // Bewertung aus localStorage laden
    const ratingKey = `rating_${file.path}`;
    const storedRating = localStorage.getItem(ratingKey);
    if (storedRating) {
      file.rating = parseInt(storedRating) || 0;
    }

  } catch (error) {
    console.error(`❌ Kritischer Fehler beim Laden der Tags für ${file.name}:`, error);
    file.tags = [];
    file.rating = 0;
  }
}

// Speichere Tags in Datei-Metadaten
async function saveFileTags(file) {
  try {
    if (!file || !file.tags) {
      console.warn('⚠️ Keine gültige Datei oder Tags zum Speichern');
      return false;
    }

    if (file.type === 'image' && window.electronAPI && window.electronAPI.metadata) {
      updateStatus('Speichere Tags...');
      try {
        const success = await window.electronAPI.metadata.writeTags(file.path, file.tags);
        if (success) {
          console.log(`💾 Tags erfolgreich gespeichert in: ${file.name}`);
          updateStatus(`Tags gespeichert in ${file.name}`);
          return true;
        } else {
          console.warn('⚠️ Metadaten-API gab false zurück');
          updateStatus('Tags konnten nicht gespeichert werden');
          return false;
        }
      } catch (metadataError) {
        console.error('❌ Fehler beim Aufrufen der Metadaten-API:', metadataError);
        updateStatus('Fehler beim Speichern der Metadaten');
        return false;
      }
    } else {
      // Für Videos oder wenn keine Metadaten-API verfügbar: Nur in Memory speichern
      console.log(`📝 Tags für ${file.name} nur lokal gespeichert (${file.type})`);
      updateStatus(`Tags für ${file.name} lokal gespeichert`);
      return true;
    }
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Tags:', error);
    updateStatus('Fehler beim Speichern der Tags');
    return false;
  }
}

// Update File Info Panel
function updateFileInfo(file) {
  const infoRows = document.querySelectorAll('.info-row');

  if (!file) {
    // Keine Datei oder Mehrfachauswahl - Info Panel leeren
    if (infoRows.length >= 3) {
      infoRows[0].querySelector('.info-value').textContent = '-';
      infoRows[1].querySelector('.info-value').textContent = '-';
      infoRows[2].querySelector('.info-value').textContent = '-';
    }

    // Clear rating display
    updateRatingSection(null);
    return;
  }

  if (infoRows.length >= 3) {
    infoRows[0].querySelector('.info-value').textContent = file.name;
    infoRows[1].querySelector('.info-value').textContent = formatFileSize(file.size || 0);

    // Formatiere Datum
    const date = file.modified ? new Date(file.modified) : new Date();
    const formattedDate = date.toLocaleDateString('de-DE');
    infoRows[2].querySelector('.info-value').textContent = formattedDate;
  }

  // Update rating section
  updateRatingSection(file);
}

// Update rating display in info panel
function updateRatingDisplay(file) {
  let ratingDisplay = document.querySelector('.file-rating-display');

  // Create rating display if it doesn't exist
  if (!ratingDisplay) {
    const propertiesPanel = document.querySelector('.properties-panel');
    if (propertiesPanel) {
      const ratingSection = document.createElement('div');
      ratingSection.className = 'info-section';
      ratingSection.innerHTML = `
        <h4>Bewertung</h4>
        <div class="file-rating-display"></div>
      `;

      // Insert after file info section
      const fileInfoSection = propertiesPanel.querySelector('.info-section');
      if (fileInfoSection) {
        fileInfoSection.parentNode.insertBefore(ratingSection, fileInfoSection.nextSibling);
      } else {
        propertiesPanel.insertBefore(ratingSection, propertiesPanel.firstChild);
      }

      ratingDisplay = ratingSection.querySelector('.file-rating-display');
    }
  }

  if (ratingDisplay && (file.type === 'image' || file.type === 'video')) {
    const rating = file.rating || 0;
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      const star = i <= rating ? '⭐' : '☆';
      stars.push(`<span class="rating-star ${i <= rating ? 'filled' : 'empty'}" data-rating="${i}">${star}</span>`);
    }

    ratingDisplay.innerHTML = `
      <div class="rating-stars-display" data-file-path="${file.path}">
        ${stars.join('')}
        <span class="rating-text">${getRatingText(rating)}</span>
      </div>
      <button class="rating-edit-btn" onclick="editFileRating('${file.path.replace(/\\/g, '\\\\')}')">
        Bewertung ändern
      </button>
    `;
  } else if (ratingDisplay) {
    ratingDisplay.innerHTML = '<span class="no-rating">Keine Bewertung verfügbar</span>';
  }
}

// Edit file rating from info panel
function editFileRating(filePath) {
  const file = allFiles.find(f => f.path === filePath);
  if (file) {
    showRatingDialog(file);
  }
}

// Get rating text
function getRatingText(rating) {
  const texts = ['Keine Bewertung', 'Schlecht', 'Okay', 'Gut', 'Sehr gut', 'Ausgezeichnet'];
  return texts[rating] || 'Keine Bewertung';
}

// Generate rating stars HTML
function generateRatingStars(rating, interactive = false) {
  if (!rating || rating === 0) {
    return interactive ? '' : null;
  }

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    const starClass = filled ? 'star filled' : 'star empty';
    const starIcon = filled ? '⭐' : '☆';

    if (interactive) {
      stars.push(`<span class="${starClass}" data-rating="${i}" onclick="setFileRating(${i})">${starIcon}</span>`);
    } else {
      stars.push(`<span class="${starClass}">${starIcon}</span>`);
    }
  }

  return stars.join('');
}

// Update rating section in right panel
function updateRatingSection(file) {
  const ratingSection = document.getElementById('ratingSection');
  const ratingStars = document.getElementById('ratingStars');
  const ratingText = document.getElementById('ratingText');
  const clearButton = document.getElementById('clearRating');

  if (!ratingSection || !ratingStars || !ratingText || !clearButton) return;

  if (!file || (file.type !== 'image' && file.type !== 'video')) {
    // Hide rating section for non-media files
    ratingSection.style.display = 'none';
    return;
  }

  // Show rating section for media files
  ratingSection.style.display = 'block';

  const rating = file.rating || 0;

  // Update stars
  const stars = ratingStars.querySelectorAll('.star');
  stars.forEach((star, index) => {
    const starRating = index + 1;
    star.classList.toggle('filled', starRating <= rating);
    star.textContent = starRating <= rating ? '⭐' : '☆';
  });

  // Update text
  ratingText.textContent = getRatingText(rating);

  // Update clear button
  clearButton.disabled = rating === 0;

  // Store current file for rating actions
  ratingSection.dataset.filePath = file.path;
}

// Set rating from right panel stars
function setFileRating(rating) {
  const ratingSection = document.getElementById('ratingSection');
  if (!ratingSection || !ratingSection.dataset.filePath) return;

  const filePath = ratingSection.dataset.filePath;
  const file = allFiles.find(f => f.path === filePath);

  if (file) {
    applyRating([file], rating);
  }
}

// Clear rating
function clearFileRating() {
  const ratingSection = document.getElementById('ratingSection');
  if (!ratingSection || !ratingSection.dataset.filePath) return;

  const filePath = ratingSection.dataset.filePath;
  const file = allFiles.find(f => f.path === filePath);

  if (file) {
    applyRating([file], 0);
  }
}

// Helper function to find file element in DOM
function findFileElement(file) {
  const fileItems = document.querySelectorAll('.file-item');
  for (const item of fileItems) {
    const fileName = item.querySelector('.file-name');
    if (fileName && fileName.textContent.trim() === file.name) {
      return item;
    }
  }
  return null;
}

// Tag Management
function handleTagInput(event) {
  if (event.key === 'Enter') {
    addTag();
  }
}

async function addTag() {
  const tagName = tagInput.value.trim();

  if (tagName === '') return;

  if (!currentFileTags.includes(tagName)) {
    currentFileTags.push(tagName);
    updateCurrentTags(currentFileTags);

    // Update file tags if file is selected
    if (selectedFiles.length > 0) {
      selectedFiles[0].tags = [...currentFileTags];

      // Auto-Save Tags
      await saveFileTags(selectedFiles[0]);
    }

    console.log('🏷️ Tag hinzugefügt:', tagName);
  }

  tagInput.value = '';
}

async function removeTag(tagName) {
  currentFileTags = currentFileTags.filter(tag => tag !== tagName);
  updateCurrentTags(currentFileTags);

  // Update file tags if file is selected
  if (selectedFiles.length > 0) {
    selectedFiles[0].tags = [...currentFileTags];

    // Auto-Save Tags
    try {
      const success = await saveFileTags(selectedFiles[0]);
      if (success) {
        console.log('💾 Tags erfolgreich nach Entfernung gespeichert');
      } else {
        console.warn('⚠️ Tags konnten nicht gespeichert werden, aber lokal entfernt');
      }
    } catch (error) {
      console.error('❌ Fehler beim Speichern nach Tag-Entfernung:', error);
      updateStatus('Tag entfernt, aber Speichern fehlgeschlagen');
    }

    // Update file grid to show new tag count
    renderFileGrid();
  }

  console.log('🗑️ Tag entfernt:', tagName);
}

function updateCurrentTags(tags = []) {
  // Stelle sicher, dass tags ein Array ist
  const tagArray = Array.isArray(tags) ? tags : [];
  currentFileTags = [...tagArray];
  currentTags.innerHTML = '';

  if (tagArray.length === 0) {
    currentTags.innerHTML = '<div class="no-tags">Keine Tags vorhanden</div>';

    // Make empty tags container a drop target
    makeDropTarget(currentTags, (data) => {
      if (data.type === 'tag' && data.source !== 'current-tags') {
        addTagToCurrentFile(data.name);
      }
    }, ['tag']);

    return;
  }

  tagArray.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-item draggable';
    tagElement.dataset.tag = tag;
    tagElement.innerHTML = `
      <span class="tag-text">${tag}</span>
      <button class="tag-remove" onclick="removeTag('${tag}')">×</button>
    `;

    // Make tag draggable
    makeDraggable(tagElement, {
      type: 'tag',
      name: tag,
      source: 'current-tags'
    }, 'tag');

    currentTags.appendChild(tagElement);
  });

  // Make current tags container a drop target
  makeDropTarget(currentTags, (data) => {
    if (data.type === 'tag' && data.source !== 'current-tags') {
      addTagToCurrentFile(data.name);
    }
  }, ['tag']);
}

// UI Updates
function updateFileCount(count = allFiles.length) {
  fileCount.textContent = `${count} Dateien`;
}

function updateStatus(message) {
  statusMessage.textContent = message;
  console.log('📊 Status:', message);
}

// Globale Funktion: Lösche alle Text-Selektionen
function clearAllTextSelections() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    selection.removeAllRanges();
  }

  // Auch für ältere Browser
  if (document.selection && document.selection.empty) {
    document.selection.empty();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();

  // Globaler Event Listener für Text-Selektion
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      // Prüfe ob die Selektion im File Grid ist
      const fileGrid = document.getElementById('fileGrid');
      if (fileGrid && selection.anchorNode && fileGrid.contains(selection.anchorNode)) {
        clearAllTextSelections();
      }
    }
  });

  // Global click listener to hide context menu
  document.addEventListener('click', (event) => {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu && !contextMenu.contains(event.target)) {
      hideContextMenu();
    }
  });

  // Global escape key listener and clipboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && currentContextMenu) {
      hideContextMenu();
      return;
    }

    // Clipboard shortcuts
    if (event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case 'c':
          if (selectedFiles.length > 0) {
            event.preventDefault();
            copyFiles(selectedFiles);
          }
          break;

        case 'x':
          if (selectedFiles.length > 0) {
            event.preventDefault();
            cutFiles(selectedFiles);
          }
          break;

        case 'v':
          if (clipboard.files.length > 0) {
            event.preventDefault();
            pasteFiles();
          }
          break;
      }
    }
  });
});

// Vollbild-Viewer für Bilder
async function openFullscreenViewer(file) {
  console.log('🖼️ Öffne Vollbild-Viewer für:', file.name);

  try {
    // Erstelle Vollbild-Modal
    const modal = document.createElement('div');
    modal.className = 'fullscreen-modal';
    modal.innerHTML = `
      <div class="fullscreen-overlay">
        <div class="fullscreen-controls">
          <div class="controls-left">
            <button class="fullscreen-btn close-btn" title="Schließen (ESC)">✕</button>
            <button class="fullscreen-btn prev-btn" title="Vorheriges Bild (←)">‹</button>
            <button class="fullscreen-btn next-btn" title="Nächstes Bild (→)">›</button>
          </div>

          <div class="fullscreen-info">
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size || 0)}</span>
          </div>

          <div class="controls-right">
            <button class="fullscreen-btn edit-btn" title="Bearbeiten (E)">✏️</button>
          </div>
        </div>

        <div class="edit-toolbar" style="display: none;">
          <div class="edit-tools">
            <button class="edit-tool-btn" data-tool="rotate-left" title="Links drehen (Q)">↺</button>
            <button class="edit-tool-btn" data-tool="rotate-right" title="Rechts drehen (W)">↻</button>
            <button class="edit-tool-btn" data-tool="flip-horizontal" title="Horizontal spiegeln (H)">⟷</button>
            <button class="edit-tool-btn" data-tool="flip-vertical" title="Vertikal spiegeln (V)">↕</button>

            <div class="slider-group">
              <div class="slider-item">
                <label class="slider-label">☀️</label>
                <input type="range" class="edit-slider" id="brightness-slider"
                       min="0" max="200" value="100" step="5"
                       title="Helligkeit: 100%">
                <span class="slider-value" id="brightness-value">100%</span>
              </div>

              <div class="slider-item">
                <label class="slider-label">🔆</label>
                <input type="range" class="edit-slider" id="contrast-slider"
                       min="0" max="200" value="100" step="5"
                       title="Kontrast: 100%">
                <span class="slider-value" id="contrast-value">100%</span>
              </div>
            </div>
          </div>

          <div class="edit-actions">
            <button class="edit-action-btn save-btn" title="Speichern (Ctrl+S)">💾</button>
            <button class="edit-action-btn reset-btn" title="Zurücksetzen (R)">↶</button>
            <button class="edit-action-btn cancel-btn" title="Abbrechen">✕</button>
          </div>
        </div>
        <div class="fullscreen-content">
          <img class="fullscreen-image" src="file://${file.path}" alt="${file.name}">
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event Listeners
    const closeBtn = modal.querySelector('.close-btn');
    const prevBtn = modal.querySelector('.prev-btn');
    const nextBtn = modal.querySelector('.next-btn');
    const editBtn = modal.querySelector('.edit-btn');
    const editToolbar = modal.querySelector('.edit-toolbar');
    const image = modal.querySelector('.fullscreen-image');

    // Edit state
    let isEditMode = false;
    let currentTransforms = {
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 100,
      contrast: 100
    };
    let originalImageData = null;

    // Schließen
    const closeViewer = () => {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleKeydown);
    };

    // Toggle Edit Mode
    const toggleEditMode = () => {
      isEditMode = !isEditMode;
      editToolbar.style.display = isEditMode ? 'flex' : 'none';
      editBtn.style.background = isEditMode ? 'rgba(0, 188, 212, 0.5)' : 'rgba(255, 255, 255, 0.2)';

      if (isEditMode) {
        // Store original image data when entering edit mode
        storeOriginalImageData();
        // Initialize sliders
        initializeSliders();
        updateStatus('Bearbeitungsmodus aktiviert');
      } else {
        updateStatus('Bearbeitungsmodus deaktiviert');
      }
    };

    // Initialize sliders
    const initializeSliders = () => {
      const brightnessSlider = modal.querySelector('#brightness-slider');
      const contrastSlider = modal.querySelector('#contrast-slider');
      const brightnessValue = modal.querySelector('#brightness-value');
      const contrastValue = modal.querySelector('#contrast-value');

      // Set initial values
      brightnessSlider.value = currentTransforms.brightness;
      contrastSlider.value = currentTransforms.contrast;
      brightnessValue.textContent = currentTransforms.brightness + '%';
      contrastValue.textContent = currentTransforms.contrast + '%';

      // Update titles
      brightnessSlider.title = `Helligkeit: ${currentTransforms.brightness}%`;
      contrastSlider.title = `Kontrast: ${currentTransforms.contrast}%`;
    };

    // Store original image data
    const storeOriginalImageData = () => {
      if (!originalImageData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    };

    // Apply transforms to image
    const applyTransforms = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate canvas size based on rotation
      const isRotated = currentTransforms.rotation % 180 !== 0;
      canvas.width = isRotated ? image.naturalHeight : image.naturalWidth;
      canvas.height = isRotated ? image.naturalWidth : image.naturalHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply transforms
      ctx.save();

      // Move to center for transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Apply rotation
      ctx.rotate((currentTransforms.rotation * Math.PI) / 180);

      // Apply flipping
      ctx.scale(
        currentTransforms.flipH ? -1 : 1,
        currentTransforms.flipV ? -1 : 1
      );

      // Draw image centered
      ctx.drawImage(
        image,
        -image.naturalWidth / 2,
        -image.naturalHeight / 2,
        image.naturalWidth,
        image.naturalHeight
      );

      ctx.restore();

      // Apply brightness and contrast
      if (currentTransforms.brightness !== 100 || currentTransforms.contrast !== 100) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const brightness = (currentTransforms.brightness - 100) * 2.55;
        const contrast = currentTransforms.contrast / 100;

        for (let i = 0; i < data.length; i += 4) {
          // Apply brightness
          data[i] += brightness;     // Red
          data[i + 1] += brightness; // Green
          data[i + 2] += brightness; // Blue

          // Apply contrast
          data[i] = ((data[i] - 128) * contrast) + 128;         // Red
          data[i + 1] = ((data[i + 1] - 128) * contrast) + 128; // Green
          data[i + 2] = ((data[i + 2] - 128) * contrast) + 128; // Blue

          // Clamp values
          data[i] = Math.max(0, Math.min(255, data[i]));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
        }

        ctx.putImageData(imageData, 0, 0);
      }

      // Update image source
      image.src = canvas.toDataURL('image/jpeg', 0.95);
    };

    // Reset all transforms
    const resetTransforms = () => {
      currentTransforms = {
        rotation: 0,
        flipH: false,
        flipV: false,
        brightness: 100,
        contrast: 100
      };

      // Reset sliders if in edit mode
      if (isEditMode) {
        const brightnessSlider = modal.querySelector('#brightness-slider');
        const contrastSlider = modal.querySelector('#contrast-slider');
        const brightnessValue = modal.querySelector('#brightness-value');
        const contrastValue = modal.querySelector('#contrast-value');

        if (brightnessSlider) {
          brightnessSlider.value = 100;
          brightnessValue.textContent = '100%';
          brightnessSlider.title = 'Helligkeit: 100%';
        }

        if (contrastSlider) {
          contrastSlider.value = 100;
          contrastValue.textContent = '100%';
          contrastSlider.title = 'Kontrast: 100%';
        }
      }

      // Reset to original image
      image.src = `file://${file.path}`;
      updateStatus('Bearbeitung zurückgesetzt');
    };

    // Save edited image
    const saveEditedImage = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Create final canvas with transforms
        const isRotated = currentTransforms.rotation % 180 !== 0;
        canvas.width = isRotated ? image.naturalHeight : image.naturalWidth;
        canvas.height = isRotated ? image.naturalWidth : image.naturalHeight;

        // Apply all transforms (same as applyTransforms but for saving)
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((currentTransforms.rotation * Math.PI) / 180);
        ctx.scale(
          currentTransforms.flipH ? -1 : 1,
          currentTransforms.flipV ? -1 : 1
        );
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        ctx.restore();

        // Convert to blob
        canvas.toBlob(async (blob) => {
          try {
            // Create new filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = file.name.split('.').pop();
            const baseName = file.name.replace(`.${extension}`, '');
            const newFileName = `${baseName}_edited_${timestamp}.${extension}`;
            const newPath = file.path.replace(file.name, newFileName);

            // Convert blob to buffer (simplified - in real app would use Electron API)
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            // In a real implementation, this would save via Electron's fs API
            console.log('💾 Würde speichern als:', newPath);
            updateStatus(`Bearbeitetes Bild würde gespeichert als: ${newFileName}`);

            // For now, just show success message
            alert(`Bild bearbeitet!\n\nWürde gespeichert werden als:\n${newFileName}\n\nTransformationen:\n- Rotation: ${currentTransforms.rotation}°\n- Horizontal gespiegelt: ${currentTransforms.flipH}\n- Vertikal gespiegelt: ${currentTransforms.flipV}\n- Helligkeit: ${currentTransforms.brightness}%\n- Kontrast: ${currentTransforms.contrast}%`);

          } catch (error) {
            console.error('❌ Fehler beim Speichern:', error);
            updateStatus('⚠️ Fehler beim Speichern des bearbeiteten Bildes');
          }
        }, 'image/jpeg', 0.95);

      } catch (error) {
        console.error('❌ Fehler beim Erstellen des bearbeiteten Bildes:', error);
        updateStatus('⚠️ Fehler beim Bearbeiten des Bildes');
      }
    };

    // Keyboard Navigation
    const handleKeydown = (event) => {
      if (isEditMode) {
        // Edit mode shortcuts
        switch (event.key.toLowerCase()) {
          case 'q':
            event.preventDefault();
            handleEditTool('rotate-left');
            break;
          case 'w':
            event.preventDefault();
            handleEditTool('rotate-right');
            break;
          case 'h':
            event.preventDefault();
            handleEditTool('flip-horizontal');
            break;
          case 'v':
            event.preventDefault();
            handleEditTool('flip-vertical');
            break;
          case 'r':
            event.preventDefault();
            resetTransforms();
            break;
          case '+':
          case '=':
            event.preventDefault();
            adjustSlider('brightness', 5);
            break;
          case '-':
            event.preventDefault();
            adjustSlider('brightness', -5);
            break;
          case 'arrowup':
            event.preventDefault();
            adjustSlider('contrast', 5);
            break;
          case 'arrowdown':
            event.preventDefault();
            adjustSlider('contrast', -5);
            break;
          case 's':
            if (event.ctrlKey) {
              event.preventDefault();
              saveEditedImage();
            }
            break;
          case 'e':
            event.preventDefault();
            toggleEditMode();
            break;
          case 'escape':
            if (isEditMode) {
              toggleEditMode();
            } else {
              closeViewer();
            }
            break;
        }
      } else {
        // Normal navigation shortcuts
        switch (event.key) {
          case 'Escape':
            closeViewer();
            break;
          case 'ArrowLeft':
            navigateImage(-1);
            break;
          case 'ArrowRight':
          case ' ':
            event.preventDefault();
            navigateImage(1);
            break;
          case 'e':
          case 'E':
            event.preventDefault();
            toggleEditMode();
            break;
        }
      }
    };

    // Navigation zwischen Bildern
    const navigateImage = (direction) => {
      const currentIndex = allFiles.findIndex(f => f.path === file.path);
      const imageFiles = allFiles.filter(f => f.type === 'image');
      const currentImageIndex = imageFiles.findIndex(f => f.path === file.path);

      if (currentImageIndex === -1) return;

      let newIndex = currentImageIndex + direction;
      if (newIndex < 0) newIndex = imageFiles.length - 1;
      if (newIndex >= imageFiles.length) newIndex = 0;

      const newFile = imageFiles[newIndex];
      if (newFile) {
        image.src = `file://${newFile.path}`;
        modal.querySelector('.file-name').textContent = newFile.name;
        modal.querySelector('.file-size').textContent = formatFileSize(newFile.size || 0);
        file = newFile; // Update current file reference
      }
    };

    // Adjust slider values with keyboard
    const adjustSlider = (type, delta) => {
      if (type === 'brightness') {
        const newValue = Math.max(0, Math.min(200, currentTransforms.brightness + delta));
        currentTransforms.brightness = newValue;

        const slider = modal.querySelector('#brightness-slider');
        const valueSpan = modal.querySelector('#brightness-value');
        if (slider && valueSpan) {
          slider.value = newValue;
          valueSpan.textContent = newValue + '%';
          slider.title = `Helligkeit: ${newValue}%`;
        }

        applyTransforms();
        updateStatus(`Helligkeit: ${newValue}%`);
      } else if (type === 'contrast') {
        const newValue = Math.max(0, Math.min(200, currentTransforms.contrast + delta));
        currentTransforms.contrast = newValue;

        const slider = modal.querySelector('#contrast-slider');
        const valueSpan = modal.querySelector('#contrast-value');
        if (slider && valueSpan) {
          slider.value = newValue;
          valueSpan.textContent = newValue + '%';
          slider.title = `Kontrast: ${newValue}%`;
        }

        applyTransforms();
        updateStatus(`Kontrast: ${newValue}%`);
      }
    };

    // Handle edit tools
    const handleEditTool = (tool) => {
      switch (tool) {
        case 'rotate-left':
          currentTransforms.rotation = (currentTransforms.rotation - 90) % 360;
          if (currentTransforms.rotation < 0) currentTransforms.rotation += 360;
          applyTransforms();
          updateStatus('Bild um 90° nach links gedreht');
          break;

        case 'rotate-right':
          currentTransforms.rotation = (currentTransforms.rotation + 90) % 360;
          applyTransforms();
          updateStatus('Bild um 90° nach rechts gedreht');
          break;

        case 'flip-horizontal':
          currentTransforms.flipH = !currentTransforms.flipH;
          applyTransforms();
          updateStatus(`Bild horizontal ${currentTransforms.flipH ? 'gespiegelt' : 'zurückgesetzt'}`);
          break;

        case 'flip-vertical':
          currentTransforms.flipV = !currentTransforms.flipV;
          applyTransforms();
          updateStatus(`Bild vertikal ${currentTransforms.flipV ? 'gespiegelt' : 'zurückgesetzt'}`);
          break;

        // Brightness and contrast are now handled by sliders
      }
    };

    // Event Listeners hinzufügen
    closeBtn.addEventListener('click', closeViewer);
    prevBtn.addEventListener('click', () => navigateImage(-1));
    nextBtn.addEventListener('click', () => navigateImage(1));
    editBtn.addEventListener('click', toggleEditMode);

    // Edit toolbar event listeners
    const editToolBtns = modal.querySelectorAll('.edit-tool-btn');
    editToolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        handleEditTool(tool);
      });
    });

    const saveBtn = modal.querySelector('.save-btn');
    const resetBtn = modal.querySelector('.reset-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    saveBtn.addEventListener('click', saveEditedImage);
    resetBtn.addEventListener('click', resetTransforms);
    cancelBtn.addEventListener('click', toggleEditMode);

    // Slider event listeners
    const brightnessSlider = modal.querySelector('#brightness-slider');
    const contrastSlider = modal.querySelector('#contrast-slider');
    const brightnessValue = modal.querySelector('#brightness-value');
    const contrastValue = modal.querySelector('#contrast-value');

    brightnessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentTransforms.brightness = value;
      brightnessValue.textContent = value + '%';
      e.target.title = `Helligkeit: ${value}%`;
      applyTransforms();
      updateStatus(`Helligkeit: ${value}%`);
    });

    contrastSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentTransforms.contrast = value;
      contrastValue.textContent = value + '%';
      e.target.title = `Kontrast: ${value}%`;
      applyTransforms();
      updateStatus(`Kontrast: ${value}%`);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('fullscreen-overlay')) {
        if (!isEditMode) {
          closeViewer();
        }
      }
    });
    document.addEventListener('keydown', handleKeydown);

    // Bild-Load-Handler
    image.addEventListener('load', () => {
      console.log('✅ Vollbild-Bild geladen:', file.name);
    });

    image.addEventListener('error', () => {
      console.error('❌ Fehler beim Laden des Vollbild-Bildes:', file.name);
      image.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJpbGQgbmljaHQgZ2VmdW5kZW48L3RleHQ+PC9zdmc+';
    });

    updateStatus(`Vollbild-Viewer geöffnet: ${file.name}`);

  } catch (error) {
    console.error('❌ Fehler beim Öffnen des Vollbild-Viewers:', error);
    updateStatus(`⚠️ Konnte Vollbild-Viewer nicht öffnen: ${file.name}`);
  }
}

// Video-Player für Videos
async function openVideoPlayer(file) {
  console.log('🎬 Öffne Video-Player für:', file.name);

  try {
    // Erstelle Video-Modal
    const modal = document.createElement('div');
    modal.className = 'fullscreen-modal video-modal';
    modal.innerHTML = `
      <div class="fullscreen-overlay">
        <div class="fullscreen-controls">
          <button class="fullscreen-btn close-btn" title="Schließen (ESC)">✕</button>
          <div class="fullscreen-info">
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size || 0)}</span>
          </div>
        </div>
        <div class="fullscreen-content video-content">
          <video class="fullscreen-video" controls autoplay>
            <source src="file://${file.path}" type="video/mp4">
            <source src="file://${file.path}" type="video/webm">
            <source src="file://${file.path}" type="video/ogg">
            Ihr Browser unterstützt das Video-Element nicht.
          </video>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event Listeners
    const closeBtn = modal.querySelector('.close-btn');
    const video = modal.querySelector('.fullscreen-video');

    // Schließen
    const closeViewer = () => {
      video.pause();
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleKeydown);
    };

    // Keyboard Controls
    const handleKeydown = (event) => {
      switch (event.key) {
        case 'Escape':
          closeViewer();
          break;
        case ' ':
          event.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;
        case 'ArrowLeft':
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'ArrowUp':
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'm':
        case 'M':
          video.muted = !video.muted;
          break;
        case 'f':
        case 'F':
          if (video.requestFullscreen) {
            video.requestFullscreen();
          }
          break;
      }
    };

    // Event Listeners hinzufügen
    closeBtn.addEventListener('click', closeViewer);
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('fullscreen-overlay')) {
        closeViewer();
      }
    });
    document.addEventListener('keydown', handleKeydown);

    // Video-Event-Handler
    video.addEventListener('loadedmetadata', () => {
      console.log('✅ Video-Metadaten geladen:', file.name);
      console.log(`📹 Dauer: ${Math.round(video.duration)}s, Auflösung: ${video.videoWidth}x${video.videoHeight}`);
    });

    video.addEventListener('error', (e) => {
      console.error('❌ Fehler beim Laden des Videos:', file.name, e);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'video-error';
      errorDiv.innerHTML = `
        <div class="error-icon">⚠️</div>
        <h3>Video konnte nicht geladen werden</h3>
        <p>${file.name}</p>
        <p>Möglicherweise wird das Format nicht unterstützt.</p>
      `;
      video.parentNode.replaceChild(errorDiv, video);
    });

    updateStatus(`Video-Player geöffnet: ${file.name}`);

  } catch (error) {
    console.error('❌ Fehler beim Öffnen des Video-Players:', error);
    updateStatus(`⚠️ Konnte Video-Player nicht öffnen: ${file.name}`);
  }
}

// ===== RATING SYSTEM =====

// Rating functions
function showRatingDialog(files) {
  const isMultiple = Array.isArray(files) && files.length > 1;
  const fileCount = isMultiple ? files.length : 1;
  const fileName = isMultiple ? `${fileCount} Dateien` : files.name || files[0]?.name;

  const modal = document.createElement('div');
  modal.className = 'rating-modal';
  modal.innerHTML = `
    <div class="rating-overlay">
      <div class="rating-dialog">
        <h3>Bewertung für ${fileName}</h3>
        <div class="rating-stars">
          <span class="star" data-rating="1">⭐</span>
          <span class="star" data-rating="2">⭐</span>
          <span class="star" data-rating="3">⭐</span>
          <span class="star" data-rating="4">⭐</span>
          <span class="star" data-rating="5">⭐</span>
        </div>
        <div class="rating-info">
          <span class="rating-text">Keine Bewertung</span>
        </div>
        <div class="rating-actions">
          <button class="rating-btn cancel-btn">Abbrechen</button>
          <button class="rating-btn clear-btn">Löschen</button>
          <button class="rating-btn apply-btn" disabled>Anwenden</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedRating = 0;
  const stars = modal.querySelectorAll('.star');
  const ratingText = modal.querySelector('.rating-text');
  const applyBtn = modal.querySelector('.apply-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const clearBtn = modal.querySelector('.clear-btn');

  // Star hover and click handlers
  stars.forEach((star, index) => {
    star.addEventListener('mouseenter', () => {
      updateStarDisplay(index + 1);
    });

    star.addEventListener('click', () => {
      selectedRating = index + 1;
      updateStarDisplay(selectedRating);
      applyBtn.disabled = false;
      ratingText.textContent = getRatingText(selectedRating);
    });
  });

  // Reset on mouse leave
  modal.querySelector('.rating-stars').addEventListener('mouseleave', () => {
    updateStarDisplay(selectedRating);
  });

  function updateStarDisplay(rating) {
    stars.forEach((star, index) => {
      if (index < rating) {
        star.style.color = '#FFD700';
        star.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
      } else {
        star.style.color = '#ddd';
        star.style.textShadow = 'none';
      }
    });

    if (rating > 0) {
      ratingText.textContent = getRatingText(rating);
    }
  }

  function getRatingText(rating) {
    const texts = ['', 'Schlecht', 'Okay', 'Gut', 'Sehr gut', 'Ausgezeichnet'];
    return texts[rating] || 'Keine Bewertung';
  }

  // Button handlers
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  clearBtn.addEventListener('click', () => {
    selectedRating = 0;
    updateStarDisplay(0);
    applyBtn.disabled = false;
    ratingText.textContent = 'Bewertung wird gelöscht';
  });

  applyBtn.addEventListener('click', async () => {
    await applyRating(files, selectedRating);
    document.body.removeChild(modal);
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('rating-overlay')) {
      document.body.removeChild(modal);
    }
  });

  // Show current rating if single file
  if (!isMultiple && files.rating) {
    selectedRating = files.rating;
    updateStarDisplay(selectedRating);
    ratingText.textContent = getRatingText(selectedRating);
    applyBtn.disabled = false;
  }
}

async function applyRating(files, rating) {
  const fileArray = Array.isArray(files) ? files : [files];
  const isMultiple = fileArray.length > 1;

  try {
    for (const file of fileArray) {
      if (file.type === 'image' || file.type === 'video') {
        file.rating = rating;

        // Speichere Bewertung in Metadaten
        try {
          await metadataService.writeRating(file.path, rating);
          console.log(`⭐ Bewertung ${rating} für ${file.name} in Metadaten gespeichert`);
        } catch (error) {
          console.warn(`⚠️ Fehler beim Speichern der Bewertung für ${file.name}:`, error);
          // Fallback: Speichere in localStorage
          localStorage.setItem(`rating_${file.path}`, rating.toString());
        }
      }
    }

    const message = isMultiple
      ? `Bewertung ${rating} Sterne für ${fileArray.length} Dateien gesetzt`
      : `Bewertung ${rating} Sterne für ${fileArray[0].name} gesetzt`;

    updateStatus(message);

    // Update UI if file is currently selected
    if (!isMultiple && selectedFiles.length === 1 && selectedFiles[0].path === fileArray[0].path) {
      updateFileInfo(fileArray[0]);
    }

    // Refresh grid to show updated ratings
    renderFileGrid();

  } catch (error) {
    console.error('❌ Fehler beim Setzen der Bewertung:', error);
    updateStatus('⚠️ Fehler beim Setzen der Bewertung');
  }
}

// ===== CLIPBOARD SYSTEM =====

// Clipboard state
let clipboard = {
  files: [],
  operation: null // 'copy' or 'cut'
};

function copyFiles(files) {
  const fileArray = Array.isArray(files) ? files : [files];
  clipboard.files = [...fileArray];
  clipboard.operation = 'copy';

  const message = fileArray.length === 1
    ? `Datei kopiert: ${fileArray[0].name}`
    : `${fileArray.length} Dateien kopiert`;

  updateStatus(message);
  console.log('📋 Dateien kopiert:', fileArray.map(f => f.name));
}

function cutFiles(files) {
  const fileArray = Array.isArray(files) ? files : [files];
  clipboard.files = [...fileArray];
  clipboard.operation = 'cut';

  // Visual feedback for cut files
  fileArray.forEach(file => {
    const fileElement = findFileElement(file);
    if (fileElement) {
      fileElement.classList.add('cut-file');
    }
  });

  const message = fileArray.length === 1
    ? `Datei ausgeschnitten: ${fileArray[0].name}`
    : `${fileArray.length} Dateien ausgeschnitten`;

  updateStatus(message);
  console.log('✂️ Dateien ausgeschnitten:', fileArray.map(f => f.name));
}

async function pasteFiles() {
  if (clipboard.files.length === 0) {
    updateStatus('Zwischenablage ist leer');
    return;
  }

  if (!currentDirectory) {
    updateStatus('Kein Zielordner ausgewählt');
    return;
  }

  try {
    const operation = clipboard.operation;
    const files = clipboard.files;

    for (const file of files) {
      const fileName = file.name;
      const sourcePath = file.path;
      const targetPath = `${currentDirectory}\\${fileName}`;

      if (operation === 'copy') {
        // TODO: Implement actual file copy via Electron API
        console.log(`📋 Kopiere: ${sourcePath} → ${targetPath}`);
      } else if (operation === 'cut') {
        // TODO: Implement actual file move via Electron API
        console.log(`✂️ Verschiebe: ${sourcePath} → ${targetPath}`);

        // Remove cut styling
        const fileElement = findFileElement(file);
        if (fileElement) {
          fileElement.classList.remove('cut-file');
        }
      }
    }

    const message = operation === 'copy'
      ? `${files.length} Datei(en) eingefügt`
      : `${files.length} Datei(en) verschoben`;

    updateStatus(message);

    // Clear clipboard after cut operation
    if (operation === 'cut') {
      clipboard.files = [];
      clipboard.operation = null;
    }

    // Refresh directory
    await loadDirectory(currentDirectory);

  } catch (error) {
    console.error('❌ Fehler beim Einfügen:', error);
    updateStatus('⚠️ Fehler beim Einfügen der Dateien');
  }
}

// ===== CONTEXT MENU SYSTEM =====

// Context Menu State
let currentContextMenu = null;

// Handle file context menu
function handleFileContextMenu(file, event) {
  event.preventDefault();
  event.stopPropagation();

  const isMultiSelection = selectedFiles.length > 1;
  const isFileSelected = selectedFiles.some(f => f.path === file.path);

  if (isMultiSelection && isFileSelected) {
    showContextMenu(event, 'multiple', selectedFiles);
  } else {
    showContextMenu(event, file.type === 'directory' ? 'folder' : 'file', file);
  }
}

// Show context menu
function showContextMenu(event, type, target) {
  hideContextMenu(); // Hide any existing menu

  const contextMenu = document.getElementById('contextMenu');
  const menuItems = generateContextMenuItems(type, target);

  // Generate menu HTML
  contextMenu.innerHTML = menuItems.map(item => {
    if (item.separator) {
      return '<div class="context-menu-separator"></div>';
    }

    return `
      <div class="context-menu-item ${item.disabled ? 'disabled' : ''}"
           data-action="${item.action}"
           data-target="${JSON.stringify(target).replace(/"/g, '&quot;')}">
        <span class="context-menu-icon">${item.icon}</span>
        <span class="context-menu-label">${item.label}</span>
        ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}
      </div>
    `;
  }).join('');

  // Position menu
  const x = Math.min(event.clientX, window.innerWidth - 220);
  const y = Math.min(event.clientY, window.innerHeight - (menuItems.length * 32 + 20));

  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.style.display = 'block';

  // Add event listeners
  contextMenu.querySelectorAll('.context-menu-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', handleContextMenuAction);
  });

  currentContextMenu = { type, target, element: contextMenu };

  console.log(`📋 Kontextmenü geöffnet: ${type}`, target);
}

// Hide context menu
function hideContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  if (contextMenu) {
    contextMenu.style.display = 'none';
    contextMenu.innerHTML = '';
  }
  currentContextMenu = null;
}

// Generate context menu items based on type
function generateContextMenuItems(type, target) {
  switch (type) {
    case 'file':
      return generateFileContextMenu(target);
    case 'folder':
      return generateFolderContextMenu(target);
    case 'multiple':
      return generateMultipleSelectionContextMenu(target);
    default:
      return [];
  }
}

// Generate file context menu
function generateFileContextMenu(file) {
  const isImage = file.type === 'image';
  const isVideo = file.type === 'video';

  const items = [];

  if (isImage) {
    items.push(
      { icon: '✏️', label: 'Bearbeiten', action: 'edit', shortcut: 'E' },
      { icon: '🖼️', label: 'Vollbild', action: 'fullscreen', shortcut: 'Space' }
    );
  }

  if (isVideo) {
    items.push(
      { icon: '▶️', label: 'Abspielen', action: 'play', shortcut: 'Space' }
    );
  }

  items.push(
    { separator: true },
    { icon: '🏷️', label: 'Tags hinzufügen', action: 'addTags', shortcut: 'T' },
    { icon: '⭐', label: 'Bewerten', action: 'rate' },
    { separator: true },
    { icon: '📋', label: 'Kopieren', action: 'copy', shortcut: 'Ctrl+C' },
    { icon: '✂️', label: 'Ausschneiden', action: 'cut', shortcut: 'Ctrl+X' },
    { separator: true },
    { icon: '📤', label: 'Exportieren', action: 'export' },
    { icon: '🗑️', label: 'Löschen', action: 'delete', shortcut: 'Del' },
    { separator: true },
    { icon: 'ℹ️', label: 'Eigenschaften', action: 'properties', shortcut: 'Alt+Enter' }
  );

  return items;
}

// Generate folder context menu
function generateFolderContextMenu(folder) {
  return [
    { icon: '📁', label: 'Öffnen', action: 'open', shortcut: 'Enter' },
    { icon: '⭐', label: 'Zu Favoriten', action: 'addFavorite', shortcut: 'F' },
    { separator: true },
    { icon: '🏷️', label: 'Alle Bilder taggen', action: 'batchTag' },
    { separator: true },
    { icon: '📋', label: 'Kopieren', action: 'copy', shortcut: 'Ctrl+C' },
    { icon: '✂️', label: 'Ausschneiden', action: 'cut', shortcut: 'Ctrl+X' },
    { separator: true },
    { icon: 'ℹ️', label: 'Eigenschaften', action: 'properties', shortcut: 'Alt+Enter' }
  ];
}

// Generate multiple selection context menu
function generateMultipleSelectionContextMenu(files) {
  const fileCount = files.length;
  const imageCount = files.filter(f => f.type === 'image').length;
  const videoCount = files.filter(f => f.type === 'video').length;

  return [
    { icon: '🏷️', label: `${fileCount} Dateien taggen`, action: 'batchAddTags' },
    { icon: '⭐', label: `${imageCount} Bilder bewerten`, action: 'batchRate', disabled: imageCount === 0 },
    { separator: true },
    { icon: '📋', label: `${fileCount} Dateien kopieren`, action: 'batchCopy', shortcut: 'Ctrl+C' },
    { icon: '✂️', label: `${fileCount} Dateien ausschneiden`, action: 'batchCut', shortcut: 'Ctrl+X' },
    { separator: true },
    { icon: '📤', label: `${fileCount} Dateien exportieren`, action: 'batchExport' },
    { icon: '🗑️', label: `${fileCount} Dateien löschen`, action: 'batchDelete', shortcut: 'Del' }
  ];
}

// Handle context menu actions
function handleContextMenuAction(event) {
  const action = event.currentTarget.getAttribute('data-action');
  const targetData = event.currentTarget.getAttribute('data-target');

  let target;
  try {
    target = JSON.parse(targetData.replace(/&quot;/g, '"'));
  } catch (e) {
    target = currentContextMenu?.target;
  }

  hideContextMenu();

  console.log(`🎯 Kontextmenü-Aktion: ${action}`, target);

  // Execute action
  executeContextMenuAction(action, target);
}

// Execute context menu actions
async function executeContextMenuAction(action, target) {
  switch (action) {
    case 'edit':
      if (target && target.type === 'image') {
        await openFullscreenViewer(target);
        // Automatically enter edit mode
        setTimeout(() => {
          const editBtn = document.querySelector('.edit-btn');
          if (editBtn) editBtn.click();
        }, 500);
      }
      break;

    case 'fullscreen':
    case 'play':
      if (target) {
        if (target.type === 'image') {
          await openFullscreenViewer(target);
        } else if (target.type === 'video') {
          await openVideoPlayer(target);
        }
      }
      break;

    case 'open':
      if (target && target.type === 'directory') {
        await loadDirectory(target.path);
      }
      break;

    case 'addTags':
      updateStatus('Tag-Dialog würde geöffnet werden');
      // TODO: Implement tag dialog
      break;

    case 'rate':
      if (target) {
        showRatingDialog(target);
      }
      break;

    case 'copy':
      if (target) {
        copyFiles(target);
      }
      break;

    case 'cut':
      if (target) {
        cutFiles(target);
      }
      break;

    case 'delete':
      if (confirm(`Möchten Sie "${target?.name || 'die ausgewählten Dateien'}" wirklich löschen?`)) {
        updateStatus(`Datei gelöscht: ${target?.name || 'Mehrere Dateien'}`);
        // TODO: Implement file deletion
      }
      break;

    case 'export':
      updateStatus(`Export gestartet: ${target?.name || 'Mehrere Dateien'}`);
      // TODO: Implement export functionality
      break;

    case 'properties':
      updateStatus(`Eigenschaften anzeigen: ${target?.name || 'Mehrere Dateien'}`);
      // TODO: Implement properties dialog
      break;

    case 'addFavorite':
      if (target && target.type === 'directory') {
        addFavorite(target.name, target.path);
        updateStatus(`Ordner zu Favoriten hinzugefügt: ${target.name}`);
      }
      break;

    case 'batchTag':
    case 'batchAddTags':
      updateStatus('Batch-Tagging würde gestartet werden');
      // TODO: Implement batch tagging
      break;

    case 'batchRate':
      if (selectedFiles.length > 0) {
        const mediaFiles = selectedFiles.filter(f => f.type === 'image' || f.type === 'video');
        if (mediaFiles.length > 0) {
          showRatingDialog(mediaFiles);
        } else {
          updateStatus('Keine bewertbaren Dateien ausgewählt');
        }
      }
      break;

    case 'batchCopy':
      if (selectedFiles.length > 0) {
        copyFiles(selectedFiles);
      }
      break;

    case 'batchCut':
      if (selectedFiles.length > 0) {
        cutFiles(selectedFiles);
      }
      break;

    case 'batchExport':
      updateStatus(`Export von ${selectedFiles.length} Dateien gestartet`);
      // TODO: Implement batch export
      break;

    case 'batchDelete':
      if (confirm(`Möchten Sie ${selectedFiles.length} Dateien wirklich löschen?`)) {
        updateStatus(`${selectedFiles.length} Dateien gelöscht`);
        // TODO: Implement batch deletion
      }
      break;

    default:
      console.warn('Unbekannte Kontextmenü-Aktion:', action);
  }
}

// ===== SYSTEM MONITORING =====

// System monitoring state
let systemMonitoring = {
  isActive: false,
  interval: null,
  lastFrameTime: 0,
  frameCount: 0,
  fps: 0,
  cpuUsage: 0,
  gpuInfo: null,
  performanceEntries: []
};

// Start system monitoring
function startSystemMonitoring() {
  if (systemMonitoring.isActive) return;

  systemMonitoring.isActive = true;
  systemMonitoring.lastFrameTime = performance.now();

  // Update stats every 2 seconds
  systemMonitoring.interval = setInterval(updateSystemStats, 2000);

  // Start FPS monitoring
  requestAnimationFrame(updateFPS);

  // Initialize GPU info
  initializeGPUInfo();

  console.log('📊 System-Monitoring gestartet');
}

// Stop system monitoring
function stopSystemMonitoring() {
  if (!systemMonitoring.isActive) return;

  systemMonitoring.isActive = false;

  if (systemMonitoring.interval) {
    clearInterval(systemMonitoring.interval);
    systemMonitoring.interval = null;
  }

  console.log('📊 System-Monitoring gestoppt');
}

// Update system statistics
function updateSystemStats() {
  updateCPUUsage();
  updateRAMUsage();
  updateGPUUsage();
  updateFPSDisplay();
}

// Estimate CPU usage based on performance
function updateCPUUsage() {
  const now = performance.now();
  const entries = performance.getEntriesByType('measure');

  // Calculate CPU usage based on recent performance entries
  let totalTime = 0;
  let busyTime = 0;

  entries.slice(-10).forEach(entry => {
    totalTime += entry.duration;
    if (entry.duration > 16) { // Frame took longer than 16ms (60fps)
      busyTime += entry.duration - 16;
    }
  });

  let cpuPercentage = 0;
  if (totalTime > 0) {
    cpuPercentage = Math.min(100, Math.round((busyTime / totalTime) * 100));
  }

  // Smooth the CPU usage
  systemMonitoring.cpuUsage = Math.round((systemMonitoring.cpuUsage * 0.7) + (cpuPercentage * 0.3));

  const cpuElement = document.getElementById('cpuUsage');
  const cpuStat = document.getElementById('cpuStat');

  if (cpuElement && cpuStat) {
    cpuElement.textContent = `CPU: ${systemMonitoring.cpuUsage}%`;

    // Update visual indicator
    cpuStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
    if (systemMonitoring.cpuUsage > 80) {
      cpuStat.classList.add('high-usage');
    } else if (systemMonitoring.cpuUsage > 50) {
      cpuStat.classList.add('medium-usage');
    } else {
      cpuStat.classList.add('low-usage');
    }
  }
}

// Update RAM usage
function updateRAMUsage() {
  if ('memory' in performance) {
    const memory = performance.memory;
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const totalMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    const percentage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);

    const ramElement = document.getElementById('ramUsage');
    const ramStat = document.getElementById('ramStat');

    if (ramElement && ramStat) {
      ramElement.textContent = `RAM: ${usedMB}MB`;
      ramElement.title = `${usedMB}MB / ${totalMB}MB (${percentage}%)`;

      // Update visual indicator
      ramStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
      if (percentage > 80) {
        ramStat.classList.add('high-usage');
      } else if (percentage > 60) {
        ramStat.classList.add('medium-usage');
      } else {
        ramStat.classList.add('low-usage');
      }
    }
  }
}

// Initialize GPU information
function initializeGPUInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

        systemMonitoring.gpuInfo = {
          vendor: vendor,
          renderer: renderer,
          webglVersion: gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1',
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
        };
      } else {
        systemMonitoring.gpuInfo = {
          vendor: 'Unknown',
          renderer: 'Unknown',
          webglVersion: gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1',
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
        };
      }
    } else {
      systemMonitoring.gpuInfo = {
        vendor: 'Software',
        renderer: 'Software Rendering',
        webglVersion: 'None',
        maxTextureSize: 0
      };
    }
  } catch (error) {
    console.warn('GPU-Info konnte nicht ermittelt werden:', error);
    systemMonitoring.gpuInfo = {
      vendor: 'Unknown',
      renderer: 'Unknown',
      webglVersion: 'Error',
      maxTextureSize: 0
    };
  }
}

// Update GPU usage display
function updateGPUUsage() {
  const gpuElement = document.getElementById('gpuUsage');
  const gpuStat = document.getElementById('gpuStat');

  if (gpuElement && gpuStat && systemMonitoring.gpuInfo) {
    const info = systemMonitoring.gpuInfo;
    let displayText = '';

    if (info.webglVersion === 'WebGL2') {
      displayText = 'GPU: WebGL2';
      gpuStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
      gpuStat.classList.add('low-usage');
    } else if (info.webglVersion === 'WebGL1') {
      displayText = 'GPU: WebGL1';
      gpuStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
      gpuStat.classList.add('medium-usage');
    } else {
      displayText = 'GPU: Software';
      gpuStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
      gpuStat.classList.add('high-usage');
    }

    gpuElement.textContent = displayText;
    gpuElement.title = `${info.vendor} ${info.renderer}`;
  }
}

// Update FPS counter
function updateFPS() {
  if (!systemMonitoring.isActive) return;

  const now = performance.now();
  systemMonitoring.frameCount++;

  // Calculate FPS every second
  if (now - systemMonitoring.lastFrameTime >= 1000) {
    systemMonitoring.fps = Math.round(systemMonitoring.frameCount * 1000 / (now - systemMonitoring.lastFrameTime));
    systemMonitoring.frameCount = 0;
    systemMonitoring.lastFrameTime = now;
  }

  requestAnimationFrame(updateFPS);
}

// Update FPS display
function updateFPSDisplay() {
  const fpsElement = document.getElementById('fpsUsage');
  const fpsStat = document.getElementById('fpsStat');

  if (fpsElement && fpsStat) {
    if (systemMonitoring.fps > 0) {
      fpsElement.textContent = `FPS: ${systemMonitoring.fps}`;

      // Update visual indicator
      fpsStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
      if (systemMonitoring.fps >= 50) {
        fpsStat.classList.add('low-usage');
      } else if (systemMonitoring.fps >= 30) {
        fpsStat.classList.add('medium-usage');
      } else {
        fpsStat.classList.add('high-usage');
      }
    } else {
      fpsElement.textContent = 'FPS: --';
      fpsStat.classList.remove('low-usage', 'medium-usage', 'high-usage');
    }
  }
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ===== SETTINGS SYSTEM =====

// Settings state
let appSettings = {
  defaultGridSize: 180,
  defaultView: 'grid',
  showTagCount: true,
  showRatings: true,
  autoLoadTags: true,
  tagSeparator: ',',
  showSystemStats: true,
  thumbnailQuality: 'medium',
  autoSave: true,
  backupBeforeSave: true,
  language: 'de'
};

// ===== INTERNATIONALIZATION SYSTEM =====

// Language translations
const translations = {
  de: {
    // Navigation
    'breadcrumb.all-images': 'Alle Bilder',

    // Filters
    'filter.all': 'Alle',
    'filter.images': '🖼️ Bilder',
    'filter.videos': '🎬 Videos',
    'filter.folders': '📁 Ordner',
    'filter.tagged': '🏷️ Getaggt',
    'filter.rated': '⭐ Bewertet',

    // Views
    'view.grid': 'Raster',
    'view.list': 'Liste',

    // Settings
    'settings.title': 'Einstellungen',
    'settings.description': 'Passe TagFusion an deine Bedürfnisse an',
    'settings.general': 'Allgemein',
    'settings.language': 'Sprache',
    'settings.appearance': 'Erscheinungsbild',
    'settings.theme': 'Design-Theme',
    'settings.theme.light': 'Hell',
    'settings.theme.dark': 'Dunkel',
    'settings.theme.auto': 'System',
    'settings.grid-size': 'Grid-Größe',
    'settings.animations': 'Animationen',
    'settings.interface-language': 'Interface-Sprache',
    'settings.date-format': 'Datumsformat',
    'settings.default-view': 'Standard-Ansicht',
    'settings.show-tag-count': 'Tag-Anzahl anzeigen',
    'settings.show-ratings': 'Bewertungen anzeigen',
    'settings.tags': 'Tags',
    'settings.auto-load-tags': 'Tags automatisch laden',
    'settings.tag-separator': 'Tag-Trennzeichen',
    'settings.performance': 'Leistung',
    'settings.system-stats': 'System-Monitoring',
    'settings.thumbnail-quality': 'Thumbnail-Qualität',
    'settings.quality.low': 'Niedrig',
    'settings.quality.medium': 'Mittel',
    'settings.quality.high': 'Hoch',
    'settings.quality.low.desc': 'Schnell, weniger Speicher',
    'settings.quality.medium.desc': 'Ausgewogen',
    'settings.quality.high.desc': 'Beste Qualität',
    'settings.cache-size': 'Cache-Größe',
    'settings.save': 'Speichern',
    'settings.auto-save': 'Automatisch speichern',
    'settings.auto-save.desc': 'Tags werden automatisch gespeichert',
    'settings.backup-before-save': 'Backup vor Speichern',
    'settings.reset': 'Zurücksetzen',

    // Buttons
    'button.reset': 'Zurücksetzen',
    'button.cancel': 'Abbrechen',
    'button.apply': 'Anwenden',

    // Status messages
    'status.ready': 'Bereit - Wähle ein Laufwerk',
    'status.loading': 'Lade...',
    'status.filter-applied': 'Filter angewendet',
    'status.settings-applied': 'Einstellungen angewendet',

    // Empty states
    'empty.no-files': 'Keine Dateien gefunden',
    'empty.no-filter-results': 'Keine Dateien für diesen Filter gefunden',
    'empty.select-folder': 'Wähle einen anderen Filter oder Ordner'
  },

  en: {
    // Navigation
    'breadcrumb.all-images': 'All Images',

    // Filters
    'filter.all': 'All',
    'filter.images': '🖼️ Images',
    'filter.videos': '🎬 Videos',
    'filter.folders': '📁 Folders',
    'filter.tagged': '🏷️ Tagged',
    'filter.rated': '⭐ Rated',

    // Views
    'view.grid': 'Grid',
    'view.list': 'List',

    // Settings
    'settings.title': 'Settings',
    'settings.description': 'Customize TagFusion to your needs',
    'settings.general': 'General',
    'settings.language': 'Language',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Design Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.auto': 'System',
    'settings.grid-size': 'Grid Size',
    'settings.animations': 'Animations',
    'settings.interface-language': 'Interface Language',
    'settings.date-format': 'Date Format',
    'settings.default-view': 'Default View',
    'settings.show-tag-count': 'Show Tag Count',
    'settings.show-ratings': 'Show Ratings',
    'settings.tags': 'Tags',
    'settings.auto-load-tags': 'Auto-load Tags',
    'settings.tag-separator': 'Tag Separator',
    'settings.performance': 'Performance',
    'settings.system-stats': 'System Monitoring',
    'settings.thumbnail-quality': 'Thumbnail Quality',
    'settings.quality.low': 'Low',
    'settings.quality.medium': 'Medium',
    'settings.quality.high': 'High',
    'settings.quality.low.desc': 'Fast, less memory',
    'settings.quality.medium.desc': 'Balanced',
    'settings.quality.high.desc': 'Best Quality',
    'settings.cache-size': 'Cache Size',
    'settings.save': 'Save',
    'settings.auto-save': 'Auto Save',
    'settings.auto-save.desc': 'Tags are saved automatically',
    'settings.backup-before-save': 'Backup Before Save',
    'settings.reset': 'Reset',

    // Buttons
    'button.reset': 'Reset',
    'button.cancel': 'Cancel',
    'button.apply': 'Apply',

    // Status messages
    'status.ready': 'Ready - Select a drive',
    'status.loading': 'Loading...',
    'status.filter-applied': 'Filter applied',
    'status.settings-applied': 'Settings applied',

    // Empty states
    'empty.no-files': 'No files found',
    'empty.no-filter-results': 'No files found for this filter',
    'empty.select-folder': 'Select a different filter or folder'
  },

  fr: {
    // Navigation
    'breadcrumb.all-images': 'Toutes les Images',

    // Filters
    'filter.all': 'Tout',
    'filter.images': '🖼️ Images',
    'filter.videos': '🎬 Vidéos',
    'filter.folders': '📁 Dossiers',
    'filter.tagged': '🏷️ Étiquetés',
    'filter.rated': '⭐ Notés',

    // Views
    'view.grid': 'Grille',
    'view.list': 'Liste',

    // Settings
    'settings.title': 'Paramètres',
    'settings.general': 'Général',
    'settings.language': 'Langue',
    'settings.appearance': 'Apparence',
    'settings.grid-size': 'Taille de Grille par Défaut',
    'settings.default-view': 'Vue par Défaut',
    'settings.show-tag-count': 'Afficher le Nombre d\'Étiquettes',
    'settings.show-ratings': 'Afficher les Notes',
    'settings.tags': 'Étiquettes',
    'settings.auto-load-tags': 'Charger les Étiquettes Automatiquement',
    'settings.tag-separator': 'Séparateur d\'Étiquettes',
    'settings.performance': 'Performance',
    'settings.system-stats': 'Surveillance Système',
    'settings.thumbnail-quality': 'Qualité des Miniatures',
    'settings.save': 'Sauvegarder',
    'settings.auto-save': 'Sauvegarde Automatique',
    'settings.backup-before-save': 'Sauvegarde Avant Enregistrement',

    // Buttons
    'button.reset': 'Réinitialiser',
    'button.cancel': 'Annuler',
    'button.apply': 'Appliquer',

    // Status messages
    'status.ready': 'Prêt - Sélectionnez un lecteur',
    'status.loading': 'Chargement...',
    'status.filter-applied': 'Filtre appliqué',
    'status.settings-applied': 'Paramètres appliqués',

    // Empty states
    'empty.no-files': 'Aucun fichier trouvé',
    'empty.no-filter-results': 'Aucun fichier trouvé pour ce filtre',
    'empty.select-folder': 'Sélectionnez un autre filtre ou dossier'
  },

  es: {
    // Navigation
    'breadcrumb.all-images': 'Todas las Imágenes',

    // Filters
    'filter.all': 'Todos',
    'filter.images': '🖼️ Imágenes',
    'filter.videos': '🎬 Videos',
    'filter.folders': '📁 Carpetas',
    'filter.tagged': '🏷️ Etiquetados',
    'filter.rated': '⭐ Valorados',

    // Views
    'view.grid': 'Cuadrícula',
    'view.list': 'Lista',

    // Settings
    'settings.title': 'Configuración',
    'settings.description': 'Personaliza TagFusion según tus necesidades',
    'settings.general': 'General',
    'settings.language': 'Idioma',
    'settings.appearance': 'Apariencia',
    'settings.theme': 'Tema de Diseño',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.auto': 'Sistema',
    'settings.grid-size': 'Tamaño de Cuadrícula',
    'settings.animations': 'Animaciones',
    'settings.interface-language': 'Idioma de la Interfaz',
    'settings.date-format': 'Formato de Fecha',
    'settings.default-view': 'Vista Predeterminada',
    'settings.show-tag-count': 'Mostrar Número de Etiquetas',
    'settings.show-ratings': 'Mostrar Valoraciones',
    'settings.tags': 'Etiquetas',
    'settings.auto-load-tags': 'Cargar Etiquetas Automáticamente',
    'settings.tag-separator': 'Separador de Etiquetas',
    'settings.performance': 'Rendimiento',
    'settings.system-stats': 'Monitoreo del Sistema',
    'settings.thumbnail-quality': 'Calidad de Miniaturas',
    'settings.quality.low': 'Baja',
    'settings.quality.medium': 'Media',
    'settings.quality.high': 'Alta',
    'settings.quality.low.desc': 'Rápido',
    'settings.quality.medium.desc': 'Equilibrado',
    'settings.quality.high.desc': 'Mejor Calidad',
    'settings.cache-size': 'Tamaño de Caché',
    'settings.save': 'Guardar',
    'settings.auto-save': 'Guardado Automático',
    'settings.auto-save.desc': 'Las etiquetas se guardan automáticamente',
    'settings.backup-before-save': 'Copia de Seguridad Antes de Guardar',
    'settings.reset': 'Restablecer',

    // Buttons
    'button.reset': 'Restablecer',
    'button.cancel': 'Cancelar',
    'button.apply': 'Aplicar',

    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',

    // Status messages
    'status.ready': 'Listo - Selecciona una unidad',
    'status.loading': 'Cargando...',
    'status.filter-applied': 'Filtro aplicado',
    'status.settings-applied': 'Configuración aplicada',

    // Empty states
    'empty.no-files': 'No se encontraron archivos',
    'empty.no-filter-results': 'No se encontraron archivos para este filtro',
    'empty.select-folder': 'Selecciona otro filtro o carpeta'
  }
};

// Current language
let currentLanguage = 'de';

// Get translation
function t(key, fallback = key) {
  const lang = translations[currentLanguage];
  return lang && lang[key] ? lang[key] : (translations['de'][key] || fallback);
}

// Apply translations to DOM
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = t(key);

    if (element.tagName === 'INPUT' && element.type === 'text') {
      element.placeholder = translation;
    } else {
      element.textContent = translation;
    }
  });

  console.log(`🌍 Sprache geändert zu: ${currentLanguage}`);
}

// Change language
function changeLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    appSettings.language = lang;
    applyTranslations();
    saveSettings();

    // Update filter display names
    updateFilterButtons();

    updateStatus(t('status.ready'));
  }
}

// Load settings from portable JSON file
async function loadSettings() {
  try {
    const saved = await portableData.readData('settings');
    if (saved) {
      appSettings = { ...appSettings, ...saved };
      console.log('⚙️ Einstellungen aus portabler Datei geladen');
    } else {
      console.log('ℹ️ Keine gespeicherten Einstellungen gefunden, verwende Standardwerte');
    }
  } catch (error) {
    console.warn('⚠️ Fehler beim Laden der Einstellungen:', error);
  }
}

// Save settings to portable JSON file
async function saveSettings() {
  try {
    await portableData.writeData('settings', appSettings);
    console.log('💾 Einstellungen in portabler Datei gespeichert');
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Einstellungen:', error);
  }
}

// Open settings dialog
function openSettingsDialog() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;

  // Load current settings into dialog
  loadSettingsIntoDialog();

  // Show modal
  modal.style.display = 'flex';

  // Setup event listeners
  setupSettingsEventListeners();

  console.log('⚙️ Einstellungs-Dialog geöffnet');
}

// Close settings dialog
function closeSettingsDialog() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Load current settings into dialog
function loadSettingsIntoDialog() {
  // Grid size
  const gridSizeSlider = document.getElementById('defaultGridSize');
  const gridSizeValue = document.getElementById('defaultGridSizeValue');
  if (gridSizeSlider && gridSizeValue) {
    gridSizeSlider.value = appSettings.defaultGridSize;
    gridSizeValue.textContent = `${appSettings.defaultGridSize}px`;
  }

  // Default view
  const defaultView = document.getElementById('defaultView');
  if (defaultView) {
    defaultView.value = appSettings.defaultView;
  }

  // Checkboxes
  const checkboxes = [
    'showTagCount', 'showRatings', 'autoLoadTags',
    'showSystemStats', 'autoSave', 'backupBeforeSave'
  ];

  checkboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = appSettings[id];
    }
  });

  // Selects
  const appLanguage = document.getElementById('appLanguage');
  if (appLanguage) {
    appLanguage.value = appSettings.language;
  }

  const tagSeparator = document.getElementById('tagSeparator');
  if (tagSeparator) {
    tagSeparator.value = appSettings.tagSeparator;
  }

  const thumbnailQuality = document.getElementById('thumbnailQuality');
  if (thumbnailQuality) {
    thumbnailQuality.value = appSettings.thumbnailQuality;
  }
}

// Setup settings event listeners
function setupSettingsEventListeners() {
  // Close button
  const closeBtn = document.getElementById('settingsClose');
  if (closeBtn) {
    closeBtn.onclick = closeSettingsDialog;
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancelSettings');
  if (cancelBtn) {
    cancelBtn.onclick = closeSettingsDialog;
  }

  // Apply button
  const applyBtn = document.getElementById('applySettings');
  if (applyBtn) {
    applyBtn.onclick = applySettings;
  }

  // Reset button
  const resetBtn = document.getElementById('resetSettings');
  if (resetBtn) {
    resetBtn.onclick = resetSettings;
  }

  // Grid size slider
  const gridSizeSlider = document.getElementById('defaultGridSize');
  const gridSizeValue = document.getElementById('defaultGridSizeValue');
  if (gridSizeSlider && gridSizeValue) {
    gridSizeSlider.oninput = (e) => {
      gridSizeValue.textContent = `${e.target.value}px`;
    };
  }

  // Close on overlay click
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal || e.target.classList.contains('settings-overlay')) {
        closeSettingsDialog();
      }
    };
  }
}

// Apply settings
function applySettings() {
  // Read values from dialog
  const gridSizeSlider = document.getElementById('defaultGridSize');
  if (gridSizeSlider) {
    appSettings.defaultGridSize = parseInt(gridSizeSlider.value);
  }

  const defaultView = document.getElementById('defaultView');
  if (defaultView) {
    appSettings.defaultView = defaultView.value;
  }

  // Checkboxes
  const checkboxes = [
    'showTagCount', 'showRatings', 'autoLoadTags',
    'showSystemStats', 'autoSave', 'backupBeforeSave'
  ];

  checkboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      appSettings[id] = checkbox.checked;
    }
  });

  // Selects
  const appLanguage = document.getElementById('appLanguage');
  if (appLanguage) {
    const newLanguage = appLanguage.value;
    if (newLanguage !== appSettings.language) {
      changeLanguage(newLanguage);
    }
  }

  const tagSeparator = document.getElementById('tagSeparator');
  if (tagSeparator) {
    appSettings.tagSeparator = tagSeparator.value;
  }

  const thumbnailQuality = document.getElementById('thumbnailQuality');
  if (thumbnailQuality) {
    appSettings.thumbnailQuality = thumbnailQuality.value;
  }

  // Save settings
  saveSettings();

  // Apply settings immediately
  applySettingsToApp();

  // Close dialog
  closeSettingsDialog();

  updateStatus('Einstellungen angewendet');
}

// Reset settings to defaults
function resetSettings() {
  if (confirm('Möchten Sie alle Einstellungen auf die Standardwerte zurücksetzen?')) {
    appSettings = {
      defaultGridSize: 180,
      defaultView: 'grid',
      showTagCount: true,
      showRatings: true,
      autoLoadTags: true,
      tagSeparator: ',',
      showSystemStats: true,
      thumbnailQuality: 'medium',
      autoSave: true,
      backupBeforeSave: true
    };

    loadSettingsIntoDialog();
    updateStatus('Einstellungen zurückgesetzt');
  }
}

// Apply settings to app
function applySettingsToApp() {
  // Update grid size
  updateGridSize(appSettings.defaultGridSize);
  const mainGridSlider = document.getElementById('gridSizeSlider');
  const mainGridValue = document.getElementById('gridSizeValue');
  if (mainGridSlider && mainGridValue) {
    mainGridSlider.value = appSettings.defaultGridSize;
    mainGridValue.textContent = `${appSettings.defaultGridSize}px`;
  }

  // Update system stats visibility
  const systemStats = document.getElementById('systemStats');
  if (systemStats) {
    systemStats.style.display = appSettings.showSystemStats ? 'flex' : 'none';
  }

  // Re-render grid to apply tag/rating visibility
  renderFileGrid();

  console.log('⚙️ Einstellungen angewendet:', appSettings);
}

// ===== DRAG & DROP SYSTEM =====

let draggedElement = null;
let draggedData = null;
let dragGhost = null;

// Initialize drag and drop system
function initializeDragAndDrop() {
  console.log('🎯 Initialisiere Drag & Drop System...');

  // File drop zone for external files
  setupFileDropZone();

  // Global drag and drop event listeners
  setupGlobalDragEvents();

  console.log('✅ Drag & Drop System initialisiert');
}

// Setup file drop zone for external files
function setupFileDropZone() {
  const fileDropZone = document.getElementById('fileDropZone');
  const mainContainer = document.querySelector('.main-container');

  if (!fileDropZone || !mainContainer) return;

  // Prevent default drag behaviors on document
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Show drop zone when files are dragged over window
  ['dragenter', 'dragover'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
      if (e.dataTransfer.types.includes('Files')) {
        fileDropZone.classList.add('active');
      }
    });
  });

  // Hide drop zone when drag leaves window
  ['dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
      // Only hide if leaving the window completely
      if (e.clientX === 0 && e.clientY === 0) {
        fileDropZone.classList.remove('active');
      }
    });
  });

  // Handle file drop
  fileDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('active');

    const files = Array.from(e.dataTransfer.files);
    console.log(`📁 ${files.length} Dateien abgelegt:`, files);

    // Filter for supported file types
    const supportedFiles = files.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'avi', 'mov', 'mkv'].includes(ext);
    });

    if (supportedFiles.length > 0) {
      updateStatus(`${supportedFiles.length} Dateien hinzugefügt`);
      // TODO: Add files to current directory or import them
      await handleDroppedFiles(supportedFiles);
    } else {
      updateStatus('Keine unterstützten Dateien gefunden');
    }
  });
}

// Setup global drag events
function setupGlobalDragEvents() {
  // Create drag ghost element
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.style.display = 'none';
  document.body.appendChild(dragGhost);

  // Global mouse move for drag ghost
  document.addEventListener('mousemove', (e) => {
    if (dragGhost && dragGhost.style.display !== 'none') {
      dragGhost.style.left = (e.clientX + 10) + 'px';
      dragGhost.style.top = (e.clientY - 10) + 'px';
    }
  });

  // Global drag end cleanup
  document.addEventListener('dragend', () => {
    cleanupDrag();
  });
}

// Handle dropped files
async function handleDroppedFiles(files) {
  console.log('📁 Verarbeite abgelegte Dateien:', files);

  for (const file of files) {
    try {
      // Create file object for display
      const fileObj = {
        name: file.name,
        path: file.path || file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified),
        isExternal: true
      };

      // Add to current files if in directory view
      if (currentDirectory && allFiles) {
        allFiles.push(fileObj);
        filteredFiles.push(fileObj);
        renderFileGrid();
        updateFileCount();
      }

      console.log(`✅ Datei hinzugefügt: ${file.name}`);
    } catch (error) {
      console.error(`❌ Fehler beim Hinzufügen von ${file.name}:`, error);
    }
  }
}

// Make element draggable
function makeDraggable(element, data, type = 'generic') {
  if (!element) return;

  element.draggable = true;
  element.classList.add('draggable');

  element.addEventListener('dragstart', (e) => {
    draggedElement = element;
    draggedData = data;

    element.classList.add('dragging');

    // Set drag data
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'all';

    // Show drag ghost
    showDragGhost(data, type);

    console.log(`🎯 Drag gestartet:`, data);
  });

  element.addEventListener('dragend', () => {
    element.classList.remove('dragging');
    cleanupDrag();
  });
}

// Make element a drop target
function makeDropTarget(element, onDrop, acceptTypes = ['all']) {
  if (!element) return;

  element.classList.add('drop-target');

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  element.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (shouldAcceptDrop(acceptTypes)) {
      element.classList.add('drag-over');
    }
  });

  element.addEventListener('dragleave', (e) => {
    // Only remove if actually leaving the element
    if (!element.contains(e.relatedTarget)) {
      element.classList.remove('drag-over');
    }
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    element.classList.remove('drag-over');

    if (shouldAcceptDrop(acceptTypes)) {
      const data = draggedData || JSON.parse(e.dataTransfer.getData('text/plain'));
      onDrop(data, element);
    }
  });
}

// Check if drop should be accepted
function shouldAcceptDrop(acceptTypes) {
  if (!draggedData) return false;
  if (acceptTypes.includes('all')) return true;

  return acceptTypes.some(type => {
    if (type === 'tag' && draggedData.type === 'tag') return true;
    if (type === 'file' && draggedData.type === 'file') return true;
    if (type === 'category' && draggedData.type === 'category') return true;
    return false;
  });
}

// Show drag ghost
function showDragGhost(data, type) {
  if (!dragGhost) return;

  let text = '';
  let className = type;

  switch (type) {
    case 'tag':
      text = `🏷️ ${data.name || data.text}`;
      break;
    case 'file':
      text = `📁 ${data.name}`;
      break;
    case 'category':
      text = `📂 ${data.name}`;
      break;
    default:
      text = data.name || data.text || 'Element';
  }

  dragGhost.textContent = text;
  dragGhost.className = `drag-ghost ${className}`;
  dragGhost.style.display = 'block';
}

// Cleanup drag operation
function cleanupDrag() {
  // Remove drag classes
  document.querySelectorAll('.dragging').forEach(el => {
    el.classList.remove('dragging');
  });

  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });

  // Hide drag ghost
  if (dragGhost) {
    dragGhost.style.display = 'none';
  }

  // Reset drag state
  draggedElement = null;
  draggedData = null;
}

// Add tag to file
function addTagToFile(file, tagName) {
  if (!file.tags) file.tags = [];

  if (!file.tags.includes(tagName)) {
    file.tags.push(tagName);
    console.log(`🏷️ Tag "${tagName}" zu Datei "${file.name}" hinzugefügt`);

    // Update UI if this is the selected file
    const selectedFile = getSelectedFile();
    if (selectedFile && selectedFile.path === file.path) {
      updateCurrentTags(file.tags);
    }

    // Refresh file grid to show updated tag count
    renderFileGrid();

    // Show feedback
    updateStatus(`Tag "${tagName}" hinzugefügt`);
  } else {
    updateStatus(`Tag "${tagName}" bereits vorhanden`);
  }
}

// Transfer tags between files
function transferTagsBetweenFiles(sourceFile, targetFile) {
  if (!sourceFile.tags || sourceFile.tags.length === 0) {
    updateStatus('Keine Tags zum Übertragen');
    return;
  }

  if (!targetFile.tags) targetFile.tags = [];

  let addedTags = 0;
  sourceFile.tags.forEach(tag => {
    if (!targetFile.tags.includes(tag)) {
      targetFile.tags.push(tag);
      addedTags++;
    }
  });

  if (addedTags > 0) {
    console.log(`🔄 ${addedTags} Tags von "${sourceFile.name}" zu "${targetFile.name}" übertragen`);

    // Update UI if target is selected file
    const selectedFile = getSelectedFile();
    if (selectedFile && selectedFile.path === targetFile.path) {
      updateCurrentTags(targetFile.tags);
    }

    // Refresh file grid
    renderFileGrid();

    updateStatus(`${addedTags} Tag${addedTags !== 1 ? 's' : ''} übertragen`);
  } else {
    updateStatus('Alle Tags bereits vorhanden');
  }
}

// Add tag to current file (from tag input or drag & drop)
function addTagToCurrentFile(tagName) {
  const selectedFile = getSelectedFile();
  if (!selectedFile) {
    updateStatus('Keine Datei ausgewählt');
    return;
  }

  addTagToFile(selectedFile, tagName);
}

// ===== PANEL RESIZING SYSTEM =====

// Panel resize state
let resizeState = {
  isResizing: false,
  currentPanel: null,
  startX: 0,
  startWidth: 0
};

// Initialize panel resizing
function initializePanelResizing() {
  console.log('🔧 Initialisiere Panel-Resizing...');

  // Load saved panel widths
  loadPanelWidths();

  // Setup sidebar resize
  const sidebarResize = document.getElementById('sidebarResize');
  if (sidebarResize) {
    sidebarResize.addEventListener('mousedown', (e) => startResize(e, 'sidebar'));
  }

  // Setup properties panel resize
  const propertiesResize = document.getElementById('propertiesResize');
  if (propertiesResize) {
    propertiesResize.addEventListener('mousedown', (e) => startResize(e, 'properties'));
  }

  // Global mouse events
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

// Start resizing
function startResize(event, panel) {
  event.preventDefault();

  resizeState.isResizing = true;
  resizeState.currentPanel = panel;
  resizeState.startX = event.clientX;

  const element = panel === 'sidebar'
    ? document.querySelector('.sidebar')
    : document.querySelector('.properties-panel');

  resizeState.startWidth = element.offsetWidth;

  // Add visual feedback
  const handle = event.target;
  handle.classList.add('resizing');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  console.log(`🔧 Resize gestartet für ${panel}: ${resizeState.startWidth}px`);
}

// Handle resize
function handleResize(event) {
  if (!resizeState.isResizing) return;

  const deltaX = event.clientX - resizeState.startX;
  let newWidth;

  if (resizeState.currentPanel === 'sidebar') {
    newWidth = resizeState.startWidth + deltaX;
    newWidth = Math.max(200, Math.min(400, newWidth)); // Min 200px, Max 400px

    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
  } else if (resizeState.currentPanel === 'properties') {
    newWidth = resizeState.startWidth - deltaX; // Reverse direction for right panel
    newWidth = Math.max(250, Math.min(500, newWidth)); // Min 250px, Max 500px

    document.documentElement.style.setProperty('--properties-width', `${newWidth}px`);
  }
}

// Stop resizing
function stopResize() {
  if (!resizeState.isResizing) return;

  // Remove visual feedback
  const handles = document.querySelectorAll('.resize-handle');
  handles.forEach(handle => handle.classList.remove('resizing'));
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  // Save panel widths
  savePanelWidths();

  console.log(`🔧 Resize beendet für ${resizeState.currentPanel}`);

  resizeState.isResizing = false;
  resizeState.currentPanel = null;
}

// Save panel widths to localStorage
function savePanelWidths() {
  const sidebarWidth = getComputedStyle(document.documentElement)
    .getPropertyValue('--sidebar-width').trim();
  const propertiesWidth = getComputedStyle(document.documentElement)
    .getPropertyValue('--properties-width').trim();

  const panelWidths = {
    sidebar: sidebarWidth,
    properties: propertiesWidth
  };

  localStorage.setItem('tagfusion-panel-widths', JSON.stringify(panelWidths));
  console.log('💾 Panel-Breiten gespeichert:', panelWidths);
}

// Load panel widths from localStorage
function loadPanelWidths() {
  try {
    const saved = localStorage.getItem('tagfusion-panel-widths');
    if (saved) {
      const panelWidths = JSON.parse(saved);

      if (panelWidths.sidebar) {
        document.documentElement.style.setProperty('--sidebar-width', panelWidths.sidebar);
      }
      if (panelWidths.properties) {
        document.documentElement.style.setProperty('--properties-width', panelWidths.properties);
      }

      console.log('📂 Panel-Breiten geladen:', panelWidths);
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Panel-Breiten:', error);
  }
}

// Global functions for onclick handlers
window.removeTag = removeTag;
window.editFileRating = editFileRating;
window.setFileRating = setFileRating;
window.clearFileRating = clearFileRating;
window.selectDrive = selectDrive;
window.showDriveOverview = showDriveOverview;

// ===== METADATA INTEGRATION SYSTEM =====

// Metadata service for reading/writing EXIF/XMP data
class MetadataService {
  constructor() {
    this.supportedImageFormats = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
  }

  // Read metadata from file
  async readMetadata(filePath) {
    try {
      if (!window.electronAPI?.metadata) {
        console.warn('Metadata API not available, using localStorage fallback');
        return this.getMetadataFromLocalStorage(filePath);
      }

      const metadata = await window.electronAPI.metadata.read(filePath);
      return {
        tags: metadata.tags || [],
        rating: metadata.rating || 0,
        dateCreated: metadata.dateCreated ? new Date(metadata.dateCreated) : new Date(),
        cameraInfo: metadata.cameraInfo || null
      };
    } catch (error) {
      console.error(`Error reading metadata from ${filePath}:`, error);
      return this.getMetadataFromLocalStorage(filePath);
    }
  }

  // Write metadata to file
  async writeMetadata(filePath, metadata) {
    try {
      if (!window.electronAPI?.metadata) {
        console.warn('Metadata API not available, using localStorage fallback');
        this.saveMetadataToLocalStorage(filePath, metadata);
        return;
      }

      await window.electronAPI.metadata.write(filePath, metadata);
      console.log(`✅ Metadata written to ${filePath}`);
    } catch (error) {
      console.error(`Error writing metadata to ${filePath}:`, error);
      // Fallback to localStorage
      this.saveMetadataToLocalStorage(filePath, metadata);
    }
  }

  // Write only tags to file
  async writeTags(filePath, tags) {
    try {
      const existingMetadata = await this.readMetadata(filePath);
      const updatedMetadata = {
        ...existingMetadata,
        tags: tags
      };
      await this.writeMetadata(filePath, updatedMetadata);
    } catch (error) {
      console.error(`Error writing tags to ${filePath}:`, error);
      throw error;
    }
  }

  // Write only rating to file
  async writeRating(filePath, rating) {
    try {
      const existingMetadata = await this.readMetadata(filePath);
      const updatedMetadata = {
        ...existingMetadata,
        rating: rating
      };
      await this.writeMetadata(filePath, updatedMetadata);
    } catch (error) {
      console.error(`Error writing rating to ${filePath}:`, error);
      throw error;
    }
  }

  // Convert hierarchical tags to flat array for IPTC
  convertTagsToIPTC(hierarchicalTags) {
    return hierarchicalTags.map(tag => {
      if (tag.fullPath) {
        return tag.fullPath;
      }
      // Build path from components
      let path = tag.category || '';
      if (tag.subcategory) path += '/' + tag.subcategory;
      if (tag.tag) path += '/' + tag.tag;
      return path;
    });
  }

  // Convert flat IPTC tags to hierarchical structure
  convertIPTCToTags(iptcTags) {
    return iptcTags.map(tagPath => {
      const parts = tagPath.split('/');
      return {
        category: parts[0] || '',
        subcategory: parts[1] || null,
        tag: parts[2] || parts[1] || parts[0],
        fullPath: tagPath
      };
    });
  }

  // LocalStorage fallback methods
  getMetadataFromLocalStorage(filePath) {
    const key = `metadata_${btoa(filePath)}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          tags: parsed.tags || [],
          rating: parsed.rating || 0,
          dateCreated: parsed.dateCreated ? new Date(parsed.dateCreated) : new Date(),
          cameraInfo: parsed.cameraInfo || null
        };
      } catch (error) {
        console.error('Error parsing stored metadata:', error);
      }
    }

    return {
      tags: [],
      rating: 0,
      dateCreated: new Date(),
      cameraInfo: null
    };
  }

  saveMetadataToLocalStorage(filePath, metadata) {
    const key = `metadata_${btoa(filePath)}`;
    localStorage.setItem(key, JSON.stringify(metadata));
  }
}

// Initialize metadata service
const metadataService = new MetadataService();

// ===== PORTABLE DATA MANAGEMENT =====

// Portable data service for JSON files next to EXE
class PortableDataService {
  constructor() {
    this.dataFiles = {
      favorites: 'favorites.json',
      tagHierarchy: 'tag-hierarchy.json',
      settings: 'settings.json',
      panelWidths: 'panel-widths.json'
    };
  }

  // Read data from JSON file
  async readData(key) {
    try {
      if (!this.dataFiles[key]) {
        throw new Error(`Unknown data key: ${key}`);
      }

      const data = await window.electronAPI.data.readJSON(this.dataFiles[key]);
      console.log(`📖 Portable data gelesen: ${key}`);
      return data;
    } catch (error) {
      console.error(`❌ Fehler beim Lesen von ${key}:`, error);
      return null;
    }
  }

  // Write data to JSON file
  async writeData(key, data) {
    try {
      if (!this.dataFiles[key]) {
        throw new Error(`Unknown data key: ${key}`);
      }

      const success = await window.electronAPI.data.writeJSON(this.dataFiles[key], data);
      if (success) {
        console.log(`💾 Portable data gespeichert: ${key}`);
      }
      return success;
    } catch (error) {
      console.error(`❌ Fehler beim Schreiben von ${key}:`, error);
      return false;
    }
  }

  // Check if data file exists
  async exists(key) {
    try {
      if (!this.dataFiles[key]) {
        return false;
      }

      return await window.electronAPI.data.exists(this.dataFiles[key]);
    } catch (error) {
      console.error(`❌ Fehler beim Prüfen von ${key}:`, error);
      return false;
    }
  }

  // Create empty portable files on first run
  async createEmptyDataFiles() {
    console.log('📁 Erstelle leere Daten-Dateien für ersten Start...');

    const dataFiles = [
      { key: 'favorites', defaultValue: [] },
      { key: 'tagHierarchy', defaultValue: this.getDefaultTagHierarchy() },
      { key: 'settings', defaultValue: this.getDefaultSettings() },
      { key: 'panelWidths', defaultValue: this.getDefaultPanelWidths() }
    ];

    for (const dataFile of dataFiles) {
      try {
        // Prüfe ob portable Datei bereits existiert
        const exists = await this.exists(dataFile.key);
        if (exists) {
          console.log(`✅ ${dataFile.key} bereits vorhanden`);
          continue;
        }

        // Erstelle leere Datei mit Standardwerten
        await this.writeData(dataFile.key, dataFile.defaultValue);
        console.log(`📁 ${dataFile.key} erstellt (leer)`);

      } catch (error) {
        console.error(`❌ Fehler beim Erstellen von ${dataFile.key}:`, error);
      }
    }

    console.log('🎉 Leere Daten-Dateien erstellt!');
  }

  // Default values (empty/minimal)
  getDefaultTagHierarchy() {
    return {
      categories: []  // Komplett leer beim ersten Start
    };
  }

  getDefaultSettings() {
    return {
      theme: 'system',
      language: 'de',
      showTags: true,
      showRatings: true,
      gridSize: 150,
      autoSave: true
    };
  }

  getDefaultPanelWidths() {
    return {
      navigation: 250,
      properties: 300
    };
  }
}

// Initialize portable data service
const portableData = new PortableDataService();

// ===== IMPORT/EXPORT SYSTEM =====

// Import/Export service for Favorites and Tag Hierarchy
class ImportExportService {
  constructor() {
    this.exportFormats = {
      favorites: {
        name: 'TagFusion Favoriten',
        extension: 'json',
        description: 'Favoriten-Liste für TagFusion'
      },
      tagHierarchy: {
        name: 'TagFusion Tag-Hierarchie',
        extension: 'json',
        description: 'Tag-Kategorien und Hierarchie für TagFusion'
      }
    };
  }

  // Export Favorites
  async exportFavorites() {
    try {
      console.log('📤 Exportiere Favoriten...');

      const result = await window.electronAPI.importExport.showSaveDialog({
        title: 'Favoriten exportieren',
        defaultPath: `TagFusion-Favoriten-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'TagFusion Favoriten', extensions: ['json'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        console.log('📤 Export abgebrochen');
        return { success: false, message: 'Export abgebrochen' };
      }

      const exportData = {
        type: 'tagfusion-favorites',
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: favorites
      };

      const exportResult = await window.electronAPI.importExport.exportFile(result.filePath, exportData);

      if (exportResult.success) {
        updateStatus(`✅ ${favorites.length} Favoriten exportiert`);
        return { success: true, message: `Favoriten erfolgreich exportiert nach: ${result.filePath}` };
      } else {
        updateStatus('❌ Fehler beim Exportieren');
        return { success: false, message: `Fehler beim Exportieren: ${exportResult.error}` };
      }

    } catch (error) {
      console.error('❌ Fehler beim Exportieren der Favoriten:', error);
      updateStatus('❌ Fehler beim Exportieren');
      return { success: false, message: `Fehler: ${error.message}` };
    }
  }

  // Import Favorites
  async importFavorites() {
    try {
      console.log('📥 Importiere Favoriten...');

      const result = await window.electronAPI.importExport.showOpenDialog({
        title: 'Favoriten importieren',
        filters: [
          { name: 'TagFusion Favoriten', extensions: ['json'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        console.log('📥 Import abgebrochen');
        return { success: false, message: 'Import abgebrochen' };
      }

      const importResult = await window.electronAPI.importExport.importFile(result.filePaths[0]);

      if (!importResult.success) {
        updateStatus('❌ Fehler beim Importieren');
        return { success: false, message: `Fehler beim Lesen der Datei: ${importResult.error}` };
      }

      const importData = importResult.data;

      // Validiere Import-Format
      if (importData.type !== 'tagfusion-favorites') {
        updateStatus('❌ Ungültiges Dateiformat');
        return { success: false, message: 'Ungültiges Dateiformat. Erwartet: TagFusion Favoriten' };
      }

      // Frage nach Überschreiben oder Zusammenführen
      const action = await this.showImportOptionsDialog('Favoriten', favorites.length, importData.data.length);

      if (action === 'cancel') {
        return { success: false, message: 'Import abgebrochen' };
      }

      if (action === 'replace') {
        favorites = [...importData.data];
      } else if (action === 'merge') {
        // Zusammenführen ohne Duplikate
        const existingPaths = new Set(favorites.map(f => f.path));
        const newFavorites = importData.data.filter(f => !existingPaths.has(f.path));
        favorites.push(...newFavorites);
      }

      // Speichere und aktualisiere UI
      await saveFavorites();
      renderFavorites();

      updateStatus(`✅ ${importData.data.length} Favoriten importiert`);
      return { success: true, message: `Favoriten erfolgreich importiert aus: ${result.filePaths[0]}` };

    } catch (error) {
      console.error('❌ Fehler beim Importieren der Favoriten:', error);
      updateStatus('❌ Fehler beim Importieren');
      return { success: false, message: `Fehler: ${error.message}` };
    }
  }

  // Export Tag Hierarchy
  async exportTagHierarchy() {
    try {
      console.log('📤 Exportiere Tag-Hierarchie...');

      const result = await window.electronAPI.importExport.showSaveDialog({
        title: 'Tag-Hierarchie exportieren',
        defaultPath: `TagFusion-Tags-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'TagFusion Tag-Hierarchie', extensions: ['json'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        console.log('📤 Export abgebrochen');
        return { success: false, message: 'Export abgebrochen' };
      }

      const totalTags = tagHierarchy.categories.reduce((sum, cat) =>
        sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.tags.length, 0), 0
      );

      const exportData = {
        type: 'tagfusion-tag-hierarchy',
        version: '1.0',
        exportDate: new Date().toISOString(),
        stats: {
          categories: tagHierarchy.categories.length,
          totalTags: totalTags
        },
        data: tagHierarchy
      };

      const exportResult = await window.electronAPI.importExport.exportFile(result.filePath, exportData);

      if (exportResult.success) {
        updateStatus(`✅ Tag-Hierarchie exportiert (${totalTags} Tags)`);
        return { success: true, message: `Tag-Hierarchie erfolgreich exportiert nach: ${result.filePath}` };
      } else {
        updateStatus('❌ Fehler beim Exportieren');
        return { success: false, message: `Fehler beim Exportieren: ${exportResult.error}` };
      }

    } catch (error) {
      console.error('❌ Fehler beim Exportieren der Tag-Hierarchie:', error);
      updateStatus('❌ Fehler beim Exportieren');
      return { success: false, message: `Fehler: ${error.message}` };
    }
  }

  // Import Tag Hierarchy
  async importTagHierarchy() {
    try {
      console.log('📥 Importiere Tag-Hierarchie...');

      const result = await window.electronAPI.importExport.showOpenDialog({
        title: 'Tag-Hierarchie importieren',
        filters: [
          { name: 'TagFusion Tag-Hierarchie', extensions: ['json'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        console.log('📥 Import abgebrochen');
        return { success: false, message: 'Import abgebrochen' };
      }

      const importResult = await window.electronAPI.importExport.importFile(result.filePaths[0]);

      if (!importResult.success) {
        updateStatus('❌ Fehler beim Importieren');
        return { success: false, message: `Fehler beim Lesen der Datei: ${importResult.error}` };
      }

      const importData = importResult.data;

      // Validiere Import-Format
      if (importData.type !== 'tagfusion-tag-hierarchy') {
        updateStatus('❌ Ungültiges Dateiformat');
        return { success: false, message: 'Ungültiges Dateiformat. Erwartet: TagFusion Tag-Hierarchie' };
      }

      const currentTags = tagHierarchy.categories.reduce((sum, cat) =>
        sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.tags.length, 0), 0
      );
      const importTags = importData.stats?.totalTags || 0;

      // Frage nach Überschreiben oder Zusammenführen
      const action = await this.showImportOptionsDialog('Tag-Hierarchie', currentTags, importTags);

      if (action === 'cancel') {
        return { success: false, message: 'Import abgebrochen' };
      }

      if (action === 'replace') {
        tagHierarchy = importData.data;
      } else if (action === 'merge') {
        // Zusammenführen der Hierarchien
        this.mergeTagHierarchies(tagHierarchy, importData.data);
      }

      // Speichere und aktualisiere UI
      await saveTagHierarchy();
      renderTagHierarchy();

      updateStatus(`✅ Tag-Hierarchie importiert (${importTags} Tags)`);
      return { success: true, message: `Tag-Hierarchie erfolgreich importiert aus: ${result.filePaths[0]}` };

    } catch (error) {
      console.error('❌ Fehler beim Importieren der Tag-Hierarchie:', error);
      updateStatus('❌ Fehler beim Importieren');
      return { success: false, message: `Fehler: ${error.message}` };
    }
  }

  // Show import options dialog
  async showImportOptionsDialog(type, currentCount, importCount) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content import-options-modal">
          <h3>Import-Optionen</h3>
          <p>Sie haben bereits <strong>${currentCount}</strong> ${type} und möchten <strong>${importCount}</strong> importieren.</p>
          <p>Wie möchten Sie vorgehen?</p>

          <div class="import-options">
            <button class="btn btn-warning" data-action="replace">
              🔄 Ersetzen
              <small>Aktuelle ${type} werden überschrieben</small>
            </button>
            <button class="btn btn-primary" data-action="merge">
              🔗 Zusammenführen
              <small>Neue ${type} werden hinzugefügt</small>
            </button>
            <button class="btn btn-secondary" data-action="cancel">
              ❌ Abbrechen
            </button>
          </div>
        </div>
      `;

      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.dataset.action) {
          const action = e.target.dataset.action || 'cancel';
          document.body.removeChild(modal);
          resolve(action);
        }
      });

      document.body.appendChild(modal);
    });
  }

  // Merge tag hierarchies
  mergeTagHierarchies(target, source) {
    for (const sourceCategory of source.categories) {
      let targetCategory = target.categories.find(cat => cat.name === sourceCategory.name);

      if (!targetCategory) {
        // Neue Kategorie hinzufügen
        target.categories.push(JSON.parse(JSON.stringify(sourceCategory)));
      } else {
        // Unterkategorien zusammenführen
        for (const sourceSubcategory of sourceCategory.subcategories) {
          let targetSubcategory = targetCategory.subcategories.find(sub => sub.name === sourceSubcategory.name);

          if (!targetSubcategory) {
            // Neue Unterkategorie hinzufügen
            targetCategory.subcategories.push(JSON.parse(JSON.stringify(sourceSubcategory)));
          } else {
            // Tags zusammenführen (ohne Duplikate)
            const existingTags = new Set(targetSubcategory.tags);
            for (const tag of sourceSubcategory.tags) {
              if (!existingTags.has(tag)) {
                targetSubcategory.tags.push(tag);
              }
            }
          }
        }
      }
    }
  }
}

// Initialize import/export service
const importExportService = new ImportExportService();

// ===== IMPORT/EXPORT MENU FUNCTIONS =====

// Show favorites import/export menu
function showFavoritesImportExportMenu() {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="export-favorites">
      📤 Favoriten exportieren
    </div>
    <div class="context-menu-item" data-action="import-favorites">
      📥 Favoriten importieren
    </div>
  `;

  // Position menu near button
  const button = document.getElementById('favoritesMenuBtn');
  const rect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = '10000';

  // Handle menu clicks
  menu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    document.body.removeChild(menu);

    if (action === 'export-favorites') {
      const result = await importExportService.exportFavorites();
      if (result.success) {
        showSuccessNotification('Export erfolgreich', result.message);
      } else {
        showErrorNotification('Export fehlgeschlagen', result.message);
      }
    } else if (action === 'import-favorites') {
      const result = await importExportService.importFavorites();
      if (result.success) {
        showSuccessNotification('Import erfolgreich', result.message);
      } else {
        showErrorNotification('Import fehlgeschlagen', result.message);
      }
    }
  });

  // Close menu on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      document.body.removeChild(menu);
      document.removeEventListener('click', closeMenu);
    }
  };

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

// Show tag hierarchy import/export menu
function showTagHierarchyImportExportMenu() {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="export-tags">
      📤 Tag-Hierarchie exportieren
    </div>
    <div class="context-menu-item" data-action="import-tags">
      📥 Tag-Hierarchie importieren
    </div>
  `;

  // Position menu near button
  const button = document.getElementById('tagHierarchyMenuBtn');
  const rect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = '10000';

  // Handle menu clicks
  menu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    document.body.removeChild(menu);

    if (action === 'export-tags') {
      const result = await importExportService.exportTagHierarchy();
      if (result.success) {
        showSuccessNotification('Export erfolgreich', result.message);
      } else {
        showErrorNotification('Export fehlgeschlagen', result.message);
      }
    } else if (action === 'import-tags') {
      const result = await importExportService.importTagHierarchy();
      if (result.success) {
        showSuccessNotification('Import erfolgreich', result.message);
      } else {
        showErrorNotification('Import fehlgeschlagen', result.message);
      }
    }
  });

  // Close menu on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      document.body.removeChild(menu);
      document.removeEventListener('click', closeMenu);
    }
  };

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

// Modern notification system (uses the new toast system)
function showNotification(title, message, type = 'info') {
  if (window.toast) {
    window.toast.show(title, message, type);
  } else {
    // Fallback to console if toast system not loaded
    console.log(`${type.toUpperCase()}: ${title} - ${message}`);
  }
}

// Enhanced notification functions
function showSuccessNotification(title, message) {
  showNotification(title, message, 'success');
}

function showErrorNotification(title, message) {
  showNotification(title, message, 'error');
}

function showWarningNotification(title, message) {
  showNotification(title, message, 'warning');
}

function showInfoNotification(title, message) {
  showNotification(title, message, 'info');
}

// Enhanced file loading with metadata
async function loadFileWithMetadata(file) {
  try {
    // Load basic file info
    const enhancedFile = { ...file };

    // Load metadata if it's an image
    if (file.type === 'image') {
      const metadata = await metadataService.readMetadata(file.path);
      enhancedFile.tags = metadata.tags;
      enhancedFile.rating = metadata.rating;
      enhancedFile.dateCreated = metadata.dateCreated;
      enhancedFile.cameraInfo = metadata.cameraInfo;
    } else {
      // For non-images, check localStorage
      const metadata = metadataService.getMetadataFromLocalStorage(file.path);
      enhancedFile.tags = metadata.tags;
      enhancedFile.rating = metadata.rating;
    }

    return enhancedFile;
  } catch (error) {
    console.error(`Error loading metadata for ${file.path}:`, error);
    return {
      ...file,
      tags: [],
      rating: 0
    };
  }
}

// ===== NEW SETTINGS DIALOG FUNCTIONALITY =====

// Initialize new settings dialog
function initializeNewSettingsDialog() {
  console.log('🔧 Initializing new settings dialog...');

  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('settingsClose');
  const cancelBtn = document.getElementById('settingsCancel');
  const saveBtn = document.getElementById('settingsSave');

  console.log('🔍 Elements found:', {
    modal: !!modal,
    closeBtn: !!closeBtn,
    cancelBtn: !!cancelBtn,
    saveBtn: !!saveBtn
  });

  if (!modal) {
    console.error('❌ Settings modal not found!');
    return;
  }

  // Tab switching
  const tabTriggers = document.querySelectorAll('.settings-tab-trigger');
  const tabContents = document.querySelectorAll('.settings-tab-content');

  tabTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const tabId = trigger.dataset.tab;

      // Update active tab trigger
      tabTriggers.forEach(t => t.classList.remove('active'));
      trigger.classList.add('active');

      // Update active tab content
      tabContents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });

      const activeContent = document.getElementById(`tab-${tabId}`);
      if (activeContent) {
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
      }
    });
  });

  // Theme selection
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const theme = card.dataset.theme;
      // Apply theme immediately for preview
      if (theme === 'light') {
        document.body.classList.remove('dark-mode');
      } else if (theme === 'dark') {
        document.body.classList.add('dark-mode');
      } else if (theme === 'auto') {
        // Apply system theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-mode', prefersDark);
      }
    });
  });

  // Language selection
  const languageOptions = document.querySelectorAll('.language-option');
  languageOptions.forEach(option => {
    option.addEventListener('click', () => {
      languageOptions.forEach(o => {
        o.classList.remove('active');
        o.querySelector('.w-4').innerHTML = '<div class="w-4 h-4 rounded-full border-2"></div>';
      });
      option.classList.add('active');
      option.querySelector('.w-4').innerHTML = '<div class="w-4 h-4 rounded-full border-2 border-primary bg-primary flex items-center justify-center"><div class="w-2 h-2 rounded-full bg-white"></div></div>';

      const lang = option.dataset.lang;
      // Apply language immediately for preview
      changeLanguage(lang);
    });
  });

  // Quality selection
  const qualityCards = document.querySelectorAll('.quality-card');
  qualityCards.forEach(card => {
    card.addEventListener('click', () => {
      qualityCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Sliders
  const gridSizeSlider = document.getElementById('gridSizeSlider');
  const gridSizeValue = document.getElementById('gridSizeValue');
  const cacheSizeSlider = document.getElementById('cacheSizeSlider');
  const cacheSizeValue = document.getElementById('cacheSizeValue');

  if (gridSizeSlider && gridSizeValue) {
    gridSizeSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      gridSizeValue.textContent = `${value}px`;
      // Update visual slider
      const percent = ((value - 120) / (300 - 120)) * 100;
      const track = gridSizeSlider.parentElement.querySelector('.bg-primary');
      const thumb = gridSizeSlider.parentElement.querySelector('.border-primary');
      if (track) track.style.width = `${percent}%`;
      if (thumb) thumb.style.left = `${percent}%`;
    });
  }

  if (cacheSizeSlider && cacheSizeValue) {
    cacheSizeSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      cacheSizeValue.textContent = `${value} MB`;
      // Update visual slider
      const percent = ((value - 50) / (1000 - 50)) * 100;
      const track = cacheSizeSlider.parentElement.querySelector('.bg-primary');
      const thumb = cacheSizeSlider.parentElement.querySelector('.border-primary');
      if (track) track.style.width = `${percent}%`;
      if (thumb) thumb.style.left = `${percent}%`;
    });
  }

  // Toggle switches
  const toggles = document.querySelectorAll('[data-state]');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isChecked = toggle.dataset.state === 'checked';
      const newState = isChecked ? 'unchecked' : 'checked';
      toggle.dataset.state = newState;

      const thumb = toggle.querySelector('div');
      if (thumb) {
        if (newState === 'checked') {
          thumb.style.transform = 'translateX(calc(100% - 2px))';
          toggle.classList.add('data-[state=checked]:bg-primary');
        } else {
          thumb.style.transform = 'translateX(0)';
          toggle.classList.remove('data-[state=checked]:bg-primary');
        }
      }
    });
  });

  // Close handlers
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔴 Close button clicked');
      modal.style.display = 'none';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔴 Cancel button clicked');
      modal.style.display = 'none';
      // Restore original settings
      loadSettingsIntoNewDialog();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('💾 Save button clicked');
      saveNewSettingsDialog();
      modal.style.display = 'none';
    });
  }

  // Close on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('🔴 Overlay clicked');
        modal.style.display = 'none';
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      console.log('🔴 Escape key pressed');
      modal.style.display = 'none';
    }
  });

  // Load current settings
  loadSettingsIntoNewDialog();
}

// Load settings into new dialog
function loadSettingsIntoNewDialog() {
  // Set theme
  const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  const themeCard = document.querySelector(`[data-theme="${currentTheme}"]`);
  if (themeCard) {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    themeCard.classList.add('active');
  }

  // Set language
  const langOption = document.querySelector(`[data-lang="${currentLanguage}"]`);
  if (langOption) {
    document.querySelectorAll('.language-option').forEach(o => {
      o.classList.remove('active');
      o.querySelector('.w-4').innerHTML = '<div class="w-4 h-4 rounded-full border-2"></div>';
    });
    langOption.classList.add('active');
    langOption.querySelector('.w-4').innerHTML = '<div class="w-4 h-4 rounded-full border-2 border-primary bg-primary flex items-center justify-center"><div class="w-2 h-2 rounded-full bg-white"></div></div>';
  }

  // Set sliders
  const gridSlider = document.getElementById('gridSizeSlider');
  const cacheSlider = document.getElementById('cacheSizeSlider');

  if (gridSlider) {
    gridSlider.value = appSettings.defaultGridSize || 180;
    gridSlider.dispatchEvent(new Event('input'));
  }

  if (cacheSlider) {
    cacheSlider.value = 200; // Default cache size
    cacheSlider.dispatchEvent(new Event('input'));
  }
}

// Save settings from new dialog
function saveNewSettingsDialog() {
  // Save theme
  const activeTheme = document.querySelector('.theme-card.active');
  if (activeTheme) {
    const theme = activeTheme.dataset.theme;
    appSettings.theme = theme;
  }

  // Save language
  const activeLang = document.querySelector('.language-option.active');
  if (activeLang) {
    const lang = activeLang.dataset.lang;
    appSettings.language = lang;
    currentLanguage = lang;
  }

  // Save grid size
  const gridSlider = document.getElementById('gridSizeSlider');
  if (gridSlider) {
    appSettings.defaultGridSize = parseInt(gridSlider.value);
  }

  // Save quality
  const activeQuality = document.querySelector('.quality-card.active');
  if (activeQuality) {
    appSettings.thumbnailQuality = activeQuality.dataset.quality;
  }

  // Save toggles
  const animationsToggle = document.getElementById('animationsToggle');
  const autoSaveToggle = document.getElementById('autoSaveToggle');

  if (animationsToggle) {
    appSettings.animations = animationsToggle.dataset.state === 'checked';
  }

  if (autoSaveToggle) {
    appSettings.autoSave = autoSaveToggle.dataset.state === 'checked';
  }

  // Apply settings
  saveSettings();
  applyTranslations();
  updateStatus(t('status.settings-applied', 'Einstellungen angewendet'));

  console.log('✅ Neue Einstellungen gespeichert:', appSettings);
}

// Override the original openSettingsDialog function
function openSettingsDialog() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'flex';
    loadSettingsIntoNewDialog();
  }
}

// Initialize the new settings dialog when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 DOM loaded, initializing settings dialog...');
  setTimeout(() => {
    initializeNewSettingsDialog();
    console.log('✅ Settings dialog initialized');
  }, 500); // Längere Verzögerung für sicheres Laden
});

// Fallback: Initialize when app is ready
window.addEventListener('load', () => {
  console.log('🔧 Window loaded, ensuring settings dialog is initialized...');
  setTimeout(() => {
    if (!document.getElementById('settingsModal')?.hasAttribute('data-initialized')) {
      initializeNewSettingsDialog();
      document.getElementById('settingsModal')?.setAttribute('data-initialized', 'true');
      console.log('✅ Settings dialog initialized (fallback)');
    }
  }, 1000);
});
