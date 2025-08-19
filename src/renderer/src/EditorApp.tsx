import React, { useState, useEffect } from 'react';
import { MediaFile, ImageOperation } from '../../types/global';
import { ImageEditor } from './components/editor/ImageEditor';
import { LanguageProvider } from './components/common/LanguageProvider';
import './EditorApp.css';

const EditorApp: React.FC = () => {
  const [file, setFile] = useState<MediaFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFileFromQuery();
  }, []);

  const loadFileFromQuery = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const filePath = urlParams.get('file');
      
      if (!filePath) {
        setError('No file specified');
        setLoading(false);
        return;
      }

      // Create a MediaFile object from the file path
      // In a real implementation, you would get file stats from the main process
      const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      
      const mediaFile: MediaFile = {
        path: filePath,
        name: fileName,
        extension,
        size: 0, // Will be populated by main process if needed
        dateModified: new Date(),
        type: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'].includes(extension) ? 'image' : 'video'
      };

      setFile(mediaFile);
      setLoading(false);
    } catch (err) {
      console.error('Error loading file:', err);
      setError('Failed to load file');
      setLoading(false);
    }
  };

  const handleSave = async (operations: ImageOperation[]) => {
    if (!file) return;

    try {
      // Call the main process to save the edited image
      const result = await window.electronAPI.editor.save(file.path, operations);
      
      if (result.success) {
        // Show success message or close window
        alert(`Image saved successfully to: ${result.outputPath}`);
        window.close();
      } else {
        alert(`Failed to save image: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Failed to save image');
    }
  };

  const handleCancel = () => {
    // Close the editor window
    window.close();
  };

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="loading-spinner"></div>
        <p>Loading image editor...</p>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="editor-error">
        <h2>Error</h2>
        <p>{error || 'No file to edit'}</p>
        <button onClick={handleCancel}>Close</button>
      </div>
    );
  }

  return (
    <LanguageProvider fallback={<div className="editor-loading">Loading editor...</div>}>
      <div className="editor-app">
        <ImageEditor
          file={file}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </LanguageProvider>
  );
};

export default EditorApp;