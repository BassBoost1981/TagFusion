import { useCallback } from 'react';
import { Copy, Scissors, Trash2, Edit3, FolderOpen, Info, Maximize } from 'lucide-react';
import { createElement } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useLightboxStore } from '../../stores/lightboxStore';
import { useContextMenuStore, type ContextMenuSection } from '../../stores/contextMenuStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useModalStore } from '../../stores/modalStore';
import { bridge } from '../../services/bridge';
import type { ImageFile } from '../../types';

interface UseImageContextMenuOptions {
  image: ImageFile;
  allImages: ImageFile[];
}

export function useImageContextMenu({ image, allImages }: UseImageContextMenuOptions) {
  const { selectedImages, selectImage, images: storeImages } = useAppStore();
  const { open: openLightbox } = useLightboxStore();
  const { show: showContextMenu } = useContextMenuStore();
  const { copy, cut } = useClipboardStore();
  const { openModal } = useModalStore();

  const isSelected = selectedImages.has(image.path);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSelected) {
      selectImage(image.path, false, false);
    }

    const selectedPaths = isSelected ? Array.from(selectedImages) : [image.path];
    const isMultiSelect = selectedPaths.length > 1;
    const imageList = allImages.length > 0 ? allImages : storeImages;

    const sections: ContextMenuSection[] = [
      {
        items: [
          {
            id: 'copy',
            label: 'Kopieren',
            icon: createElement(Copy, { size: 14 }),
            shortcut: 'Strg+C',
            onClick: () => copy(selectedPaths.map(p => ({ path: p, isFolder: false }))),
          },
          {
            id: 'cut',
            label: 'Ausschneiden',
            icon: createElement(Scissors, { size: 14 }),
            shortcut: 'Strg+X',
            onClick: () => cut(selectedPaths.map(p => ({ path: p, isFolder: false }))),
          },
        ],
      },
      {
        items: [
          {
            id: 'rename',
            label: 'Umbenennen',
            icon: createElement(Edit3, { size: 14 }),
            shortcut: 'F2',
            disabled: isMultiSelect,
            onClick: () => openModal('rename', { path: image.path, name: image.fileName, isFolder: false }),
          },
          {
            id: 'delete',
            label: 'Löschen',
            icon: createElement(Trash2, { size: 14 }),
            shortcut: 'Entf',
            danger: true,
            onClick: () => openModal('deleteConfirm', { paths: selectedPaths }),
          },
        ],
      },
      {
        items: [
          {
            id: 'lightbox',
            label: 'In Lightbox öffnen',
            icon: createElement(Maximize, { size: 14 }),
            disabled: isMultiSelect,
            onClick: () => openLightbox(image, imageList),
          },
          {
            id: 'explorer',
            label: 'Im Explorer öffnen',
            icon: createElement(FolderOpen, { size: 14 }),
            disabled: isMultiSelect,
            onClick: () => bridge.openInExplorer(image.path),
          },
          {
            id: 'properties',
            label: 'Eigenschaften',
            icon: createElement(Info, { size: 14 }),
            shortcut: 'Alt+Enter',
            disabled: isMultiSelect,
            onClick: () => openModal('properties', { path: image.path }),
          },
        ],
      },
    ];

    showContextMenu(e.clientX, e.clientY, sections);
  }, [image, isSelected, selectedImages, allImages, storeImages, selectImage, copy, cut, openModal, openLightbox, showContextMenu]);

  return handleContextMenu;
}

