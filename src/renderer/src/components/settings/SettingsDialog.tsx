import React, { useState } from 'react';
import { ThemeSettings } from './ThemeSettings';
import { ConfigurationSettings } from './ConfigurationSettings';
import { useServices } from '../../services/DIContainer';
import './SettingsDialog.css';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'theme' | 'performance' | 'export' | 'configuration';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState({
    language: 'en',
    thumbnailSize: 'medium',
    viewMode: 'grid',
    performance: {
      gpuAcceleration: true,
      cacheSize: 1024,
      workerThreads: 4,
    },
    export: {
      defaultQuality: 90,
      defaultSize: 'original',
      preserveMetadata: true,
    },
  });
  
  const { configurationService } = useServices();

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'theme', label: 'Theme', icon: '🎨' },
    { id: 'performance', label: 'Performance', icon: '⚡' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'configuration', label: 'Configuration', icon: '💾' },
  ];

  const handleSave = async () => {
    try {
      await configurationService.saveSettings(settings);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = () => {
    setSettings({
      language: 'en',
      thumbnailSize: 'medium',
      viewMode: 'grid',
      performance: {
        gpuAcceleration: true,
        cacheSize: 1024,
        workerThreads: 4,
      },
      export: {
        defaultQuality: 90,
        defaultSize: 'original',
        preserveMetadata: true,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="settings-dialog-overlay">
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="settings-dialog-content">
          <div className="settings-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-content">
            {activeTab === 'general' && (
              <div className="settings-panel">
                <h3>General Settings</h3>
                
                <div className="setting-group">
                  <label>Language:</label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                  >
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Default Thumbnail Size:</label>
                  <select
                    value={settings.thumbnailSize}
                    onChange={(e) => setSettings(prev => ({ ...prev, thumbnailSize: e.target.value }))}
                  >
                    <option value="small">Small (128px)</option>
                    <option value="medium">Medium (256px)</option>
                    <option value="large">Large (512px)</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Default View Mode:</label>
                  <select
                    value={settings.viewMode}
                    onChange={(e) => setSettings(prev => ({ ...prev, viewMode: e.target.value }))}
                  >
                    <option value="grid">Grid View</option>
                    <option value="list">List View</option>
                    <option value="details">Details View</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'theme' && <ThemeSettings />}

            {activeTab === 'performance' && (
              <div className="settings-panel">
                <h3>Performance Settings</h3>
                
                <div className="setting-group">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={settings.performance.gpuAcceleration}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        performance: { ...prev.performance, gpuAcceleration: e.target.checked }
                      }))}
                    />
                    Enable GPU Acceleration
                  </label>
                  <small>Use hardware acceleration for better performance</small>
                </div>

                <div className="setting-group">
                  <label>Cache Size (MB):</label>
                  <input
                    type="number"
                    min="256"
                    max="4096"
                    step="256"
                    value={settings.performance.cacheSize}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      performance: { ...prev.performance, cacheSize: parseInt(e.target.value) }
                    }))}
                  />
                  <small>Amount of memory to use for caching thumbnails and metadata</small>
                </div>

                <div className="setting-group">
                  <label>Worker Threads:</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={settings.performance.workerThreads}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      performance: { ...prev.performance, workerThreads: parseInt(e.target.value) }
                    }))}
                  />
                  <small>Number of background threads for processing</small>
                </div>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="settings-panel">
                <h3>Export Settings</h3>
                
                <div className="setting-group">
                  <label>Default Quality:</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.export.defaultQuality}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      export: { ...prev.export, defaultQuality: parseInt(e.target.value) }
                    }))}
                  />
                  <span>{settings.export.defaultQuality}%</span>
                </div>

                <div className="setting-group">
                  <label>Default Size:</label>
                  <select
                    value={settings.export.defaultSize}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      export: { ...prev.export, defaultSize: e.target.value }
                    }))}
                  >
                    <option value="original">Original Size</option>
                    <option value="web">Web Size (1920px)</option>
                    <option value="custom">Custom Size</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={settings.export.preserveMetadata}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        export: { ...prev.export, preserveMetadata: e.target.checked }
                      }))}
                    />
                    Preserve Metadata by Default
                  </label>
                  <small>Keep EXIF data and tags when exporting</small>
                </div>
              </div>
            )}

            {activeTab === 'configuration' && <ConfigurationSettings />}
          </div>
        </div>

        <div className="settings-dialog-footer">
          <button className="settings-button secondary" onClick={handleReset}>
            Reset to Defaults
          </button>
          <div className="settings-actions">
            <button className="settings-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="settings-button primary" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
