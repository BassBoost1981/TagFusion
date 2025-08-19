import React, { useState } from 'react';
import { ImageOperation, CropArea, RotationAngle } from '../../../../types/global';
import { EditorTool } from './ImageEditor';
import './ToolControlPanel.css';

export interface ToolControlPanelProps {
  tool: EditorTool;
  onApplyOperation: (operation: ImageOperation) => void;
}

export const ToolControlPanel: React.FC<ToolControlPanelProps> = ({
  tool,
  onApplyOperation,
}) => {
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [resizeScale, setResizeScale] = useState(100);

  const handleSliderChange = (type: 'brightness' | 'contrast' | 'saturation', value: number) => {
    switch (type) {
      case 'brightness':
        setBrightness(value);
        break;
      case 'contrast':
        setContrast(value);
        break;
      case 'saturation':
        setSaturation(value);
        break;
    }
  };

  const handleApplySlider = (type: 'brightness' | 'contrast' | 'saturation', value: number) => {
    onApplyOperation({
      type,
      value,
      timestamp: new Date(),
    });
  };

  const handleRotate = (degrees: 90 | 180 | 270) => {
    onApplyOperation({
      type: 'rotate',
      value: { degrees } as RotationAngle,
      timestamp: new Date(),
    });
  };

  const handleResize = () => {
    const scale = resizeScale / 100;
    onApplyOperation({
      type: 'resize',
      value: scale,
      timestamp: new Date(),
    });
  };

  const renderBrightnessControls = () => (
    <div className="tool-controls">
      <h3>Brightness</h3>
      <div className="slider-control">
        <label>Brightness: {brightness}</label>
        <input
          type="range"
          min="-100"
          max="100"
          value={brightness}
          onChange={(e) => handleSliderChange('brightness', parseInt(e.target.value))}
          className="slider"
        />
        <div className="control-buttons">
          <button
            className="apply-button"
            onClick={() => handleApplySlider('brightness', brightness)}
          >
            Apply
          </button>
          <button
            className="reset-button"
            onClick={() => setBrightness(0)}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  const renderContrastControls = () => (
    <div className="tool-controls">
      <h3>Contrast</h3>
      <div className="slider-control">
        <label>Contrast: {contrast}</label>
        <input
          type="range"
          min="-100"
          max="100"
          value={contrast}
          onChange={(e) => handleSliderChange('contrast', parseInt(e.target.value))}
          className="slider"
        />
        <div className="control-buttons">
          <button
            className="apply-button"
            onClick={() => handleApplySlider('contrast', contrast)}
          >
            Apply
          </button>
          <button
            className="reset-button"
            onClick={() => setContrast(0)}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  const renderSaturationControls = () => (
    <div className="tool-controls">
      <h3>Saturation</h3>
      <div className="slider-control">
        <label>Saturation: {saturation}%</label>
        <input
          type="range"
          min="0"
          max="200"
          value={saturation}
          onChange={(e) => handleSliderChange('saturation', parseInt(e.target.value))}
          className="slider"
        />
        <div className="control-buttons">
          <button
            className="apply-button"
            onClick={() => handleApplySlider('saturation', saturation)}
          >
            Apply
          </button>
          <button
            className="reset-button"
            onClick={() => setSaturation(100)}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  const renderRotateControls = () => (
    <div className="tool-controls">
      <h3>Rotate</h3>
      <div className="rotate-buttons">
        <button
          className="rotate-button"
          onClick={() => handleRotate(270)}
          title="Rotate 90° Left"
        >
          ↶ 90° Left
        </button>
        <button
          className="rotate-button"
          onClick={() => handleRotate(90)}
          title="Rotate 90° Right"
        >
          ↷ 90° Right
        </button>
        <button
          className="rotate-button"
          onClick={() => handleRotate(180)}
          title="Rotate 180°"
        >
          ↻ 180°
        </button>
      </div>
    </div>
  );

  const renderCropControls = () => (
    <div className="tool-controls">
      <h3>Crop</h3>
      <div className="crop-instructions">
        <p>Click and drag on the image to select the area to crop.</p>
        <p>The crop will be applied automatically when you release the mouse.</p>
      </div>
      <div className="crop-presets">
        <h4>Aspect Ratio Presets:</h4>
        <div className="preset-buttons">
          <button className="preset-button">1:1 Square</button>
          <button className="preset-button">4:3 Standard</button>
          <button className="preset-button">16:9 Widescreen</button>
          <button className="preset-button">3:2 Photo</button>
        </div>
      </div>
    </div>
  );

  const renderResizeControls = () => (
    <div className="tool-controls">
      <h3>Resize</h3>
      <div className="resize-control">
        <label>Scale: {resizeScale}%</label>
        <input
          type="range"
          min="10"
          max="200"
          value={resizeScale}
          onChange={(e) => setResizeScale(parseInt(e.target.value))}
          className="slider"
        />
        <div className="resize-presets">
          <button
            className="preset-button"
            onClick={() => setResizeScale(50)}
          >
            50%
          </button>
          <button
            className="preset-button"
            onClick={() => setResizeScale(75)}
          >
            75%
          </button>
          <button
            className="preset-button"
            onClick={() => setResizeScale(100)}
          >
            100%
          </button>
          <button
            className="preset-button"
            onClick={() => setResizeScale(150)}
          >
            150%
          </button>
          <button
            className="preset-button"
            onClick={() => setResizeScale(200)}
          >
            200%
          </button>
        </div>
        <div className="control-buttons">
          <button
            className="apply-button"
            onClick={handleResize}
          >
            Apply Resize
          </button>
          <button
            className="reset-button"
            onClick={() => setResizeScale(100)}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  const renderToolControls = () => {
    switch (tool.type) {
      case 'brightness':
        return renderBrightnessControls();
      case 'contrast':
        return renderContrastControls();
      case 'saturation':
        return renderSaturationControls();
      case 'rotate':
        return renderRotateControls();
      case 'crop':
        return renderCropControls();
      case 'resize':
        return renderResizeControls();
      default:
        return <div className="tool-controls">Tool controls not implemented</div>;
    }
  };

  return (
    <div className="tool-control-panel">
      {renderToolControls()}
    </div>
  );
};