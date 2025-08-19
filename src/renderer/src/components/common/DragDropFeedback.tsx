import React from 'react';
import { useDragDropContext } from './DragDropProvider';

export const DragDropFeedback: React.FC = () => {
  const { isDragging, dragData } = useDragDropContext();

  if (!isDragging || !dragData) {
    return null;
  }

  return (
    <div className="drag-drop-feedback">
      <div className="drag-preview">
        {dragData.type === 'files' && (
          <div className="drag-files">
            📁 {dragData.items.length} file{dragData.items.length > 1 ? 's' : ''}
          </div>
        )}
        {dragData.type === 'folder' && (
          <div className="drag-folder">
            📂 {dragData.item.name}
          </div>
        )}
        {dragData.type === 'tag' && (
          <div className="drag-tag">
            🏷️ {dragData.item.name}
          </div>
        )}
      </div>
    </div>
  );
};