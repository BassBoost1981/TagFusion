import React from 'react';
import { EditorTool } from './ImageEditor';
import './EditorToolbar.css';

export interface EditorToolbarProps {
  tools: EditorTool[];
  activeTool: EditorTool | null;
  onToolSelect: (tool: EditorTool | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onCancel: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  tools,
  activeTool,
  onToolSelect,
  onUndo,
  onRedo,
  onReset,
  onSave,
  onCancel,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="editor-toolbar">
      <div className="toolbar-section file-actions">
        <button
          className="toolbar-button save"
          onClick={onSave}
          title="Save (Ctrl+S)"
        >
          💾 Save
        </button>
        <button
          className="toolbar-button cancel"
          onClick={onCancel}
          title="Cancel (Esc)"
        >
          ❌ Cancel
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-section tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`toolbar-button tool ${activeTool?.id === tool.id ? 'active' : ''}`}
            onClick={() => onToolSelect(activeTool?.id === tool.id ? null : tool)}
            title={tool.name}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-name">{tool.name}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-section history">
        <button
          className={`toolbar-button ${!canUndo ? 'disabled' : ''}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          className={`toolbar-button ${!canRedo ? 'disabled' : ''}`}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
        <button
          className="toolbar-button reset"
          onClick={onReset}
          title="Reset to Original"
        >
          🔄 Reset
        </button>
      </div>
    </div>
  );
};