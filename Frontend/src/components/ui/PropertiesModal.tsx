import { useState, useEffect } from 'react';
import { GlassModal, GlassButton } from './glass';
import { useModalStore, type PropertiesData } from '../../stores/modalStore';
import { bridge } from '../../services/bridge';
import { FileText, Folder, Calendar, HardDrive, Image } from 'lucide-react';
import { Spinner } from '@heroui/react';

interface FileProperties {
  name: string;
  path: string;
  size: number;
  created: string;
  modified: string;
  isFolder: boolean;
  dimensions?: { width: number; height: number };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PropertiesModal() {
  const { type, data, closeModal } = useModalStore();
  const [properties, setProperties] = useState<FileProperties | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = type === 'properties';
  const propData = data as PropertiesData | null;

  useEffect(() => {
    if (isOpen && propData) {
      loadProperties(propData.path);
    }
  }, [isOpen, propData]);

  const loadProperties = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const props = await bridge.getProperties(path);
      setProperties(props);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eigenschaften konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInExplorer = async () => {
    if (propData) {
      await bridge.openInExplorer(propData.path);
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={closeModal} title="Eigenschaften" size="sm">
      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner color="secondary" />
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        {properties && !isLoading && (
          <>
            {/* Icon and name */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                {properties.isFolder ? (
                  <Folder size={24} className="text-cyan-400" />
                ) : (
                  <Image size={24} className="text-cyan-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-200 truncate">{properties.name}</h3>
                <p className="text-xs text-slate-500 truncate">{properties.path}</p>
              </div>
            </div>

            {/* Properties list */}
            <div className="space-y-3">
              {!properties.isFolder && (
                <div className="flex items-center gap-3">
                  <HardDrive size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-400">Größe:</span>
                  <span className="text-sm text-slate-200 ml-auto">{formatBytes(properties.size)}</span>
                </div>
              )}

              {properties.dimensions && (
                <div className="flex items-center gap-3">
                  <Image size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-400">Abmessungen:</span>
                  <span className="text-sm text-slate-200 ml-auto">
                    {properties.dimensions.width} × {properties.dimensions.height} px
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-slate-500" />
                <span className="text-sm text-slate-400">Erstellt:</span>
                <span className="text-sm text-slate-200 ml-auto">{formatDate(properties.created)}</span>
              </div>

              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-slate-500" />
                <span className="text-sm text-slate-400">Geändert:</span>
                <span className="text-sm text-slate-200 ml-auto">{formatDate(properties.modified)}</span>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <GlassButton variant="ghost" onClick={handleOpenInExplorer}>
            <FileText size={16} />
            Im Explorer öffnen
          </GlassButton>
          <GlassButton variant="accent" onClick={closeModal}>
            Schließen
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
