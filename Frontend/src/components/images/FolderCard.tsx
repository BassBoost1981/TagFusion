import React from 'react';
import { motion } from 'framer-motion';
import { Folder, Image as ImageIcon, Film, Copy, Scissors, Trash2, Edit3, FolderOpen, Info } from 'lucide-react';
import type { GridItem } from '../../types';
import { useAppStore } from '../../stores/appStore';
import { useContextMenuStore, type ContextMenuSection } from '../../stores/contextMenuStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useModalStore } from '../../stores/modalStore';
import { bridge } from '../../services/bridge';

interface FolderCardProps {
    item: GridItem;
}

export function FolderCard({ item }: FolderCardProps) {
    const { navigateToFolder } = useAppStore();
    const { show: showContextMenu } = useContextMenuStore();
    const { copy, cut } = useClipboardStore();
    const { openModal } = useModalStore();

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToFolder(item.path);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const sections: ContextMenuSection[] = [
            {
                items: [
                    {
                        id: 'copy',
                        label: 'Kopieren',
                        icon: <Copy size={14} />,
                        shortcut: 'Strg+C',
                        onClick: () => copy([{ path: item.path, isFolder: true }]),
                    },
                    {
                        id: 'cut',
                        label: 'Ausschneiden',
                        icon: <Scissors size={14} />,
                        shortcut: 'Strg+X',
                        onClick: () => cut([{ path: item.path, isFolder: true }]),
                    },
                ],
            },
            {
                items: [
                    {
                        id: 'rename',
                        label: 'Umbenennen',
                        icon: <Edit3 size={14} />,
                        shortcut: 'F2',
                        onClick: () => openModal('rename', { path: item.path, name: item.name, isFolder: true }),
                    },
                    {
                        id: 'delete',
                        label: 'Löschen',
                        icon: <Trash2 size={14} />,
                        shortcut: 'Entf',
                        danger: true,
                        onClick: () => openModal('deleteConfirm', { paths: [item.path] }),
                    },
                ],
            },
            {
                items: [
                    {
                        id: 'explorer',
                        label: 'Im Explorer öffnen',
                        icon: <FolderOpen size={14} />,
                        onClick: () => bridge.openInExplorer(item.path),
                    },
                    {
                        id: 'properties',
                        label: 'Eigenschaften',
                        icon: <Info size={14} />,
                        shortcut: 'Alt+Enter',
                        onClick: () => openModal('properties', { path: item.path }),
                    },
                ],
            },
        ];

        showContextMenu(e.clientX, e.clientY, sections);
    };

    return (
        <motion.div
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            className="relative group cursor-pointer rounded-xl overflow-hidden"
            style={{
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
        >
            {/* Card Body - Glass Style matching ImageCard */}
            <div
                className="relative rounded-xl overflow-hidden backdrop-blur-glass-sm flex flex-col h-full"
                style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid rgba(6, 182, 212, 0.15)',
                    aspectRatio: '1/1' // Maintain square aspect ratio
                }}
            >
                {/* Icon Area */}
                <div className="flex-1 flex items-center justify-center bg-[var(--glass-bg)] relative overflow-hidden group-hover:bg-[var(--glass-bg-hover)] transition-colors">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-500" />

                    <Folder
                        size={64}
                        className="text-cyan-400 drop-shadow-lg relative z-10 group-hover:text-cyan-300 transition-colors"
                        strokeWidth={1.5}
                        fill="rgba(34, 211, 238, 0.1)"
                    />
                </div>

                {/* Info Area */}
                <div
                    className="p-3 relative bg-[var(--glass-bg)] border-t border-[var(--glass-border)]"
                >
                    {/* Specular highlight */}
                    <div
                        className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-specular)] to-transparent"
                    />

                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate mb-1.5" title={item.name}>
                        {item.name}
                    </h3>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] h-4">
                        {(item.subfolderCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1" title={`${item.subfolderCount} Ordner`}>
                                <Folder size={10} className="text-[var(--color-text-muted)]" />
                                <span>{item.subfolderCount}</span>
                            </div>
                        )}
                        {(item.imageCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1" title={`${item.imageCount} Bilder`}>
                                <ImageIcon size={10} className="text-[var(--color-text-muted)]" />
                                <span>{item.imageCount}</span>
                            </div>
                        )}
                        {(item.videoCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1" title={`${item.videoCount} Videos`}>
                                <Film size={10} className="text-[var(--color-text-muted)]" />
                                <span>{item.videoCount}</span>
                            </div>
                        )}
                        {(item.subfolderCount === 0 && item.imageCount === 0 && item.videoCount === 0) && (
                            <span className="opacity-50">Leer</span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
