import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolControlPanel } from '../ToolControlPanel';
import { EditorTool } from '../ImageEditor';

describe('ToolControlPanel', () => {
  const mockOnApplyOperation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brightness Tool', () => {
    const brightnessTool: EditorTool = {
      id: 'brightness',
      name: 'Brightness',
      icon: '☀️',
      type: 'brightness',
    };

    it('should render brightness controls', () => {
      render(
        <ToolControlPanel
          tool={brightnessTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      expect(screen.getByText('Brightness')).toBeInTheDocument();
      expect(screen.getByText('Brightness: 0')).toBeInTheDocument();
      expect(screen.getByText(/Apply/)).toBeInTheDocument();
      expect(screen.getByText(/Reset/)).toBeInTheDocument();
    });

    it('should update brightness value when slider changes', () => {
      render(
        <ToolControlPanel
          tool={brightnessTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '50' } });

      expect(screen.getByText('Brightness: 50')).toBeInTheDocument();
    });

    it('should call onApplyOperation when apply button is clicked', () => {
      render(
        <ToolControlPanel
          tool={brightnessTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '25' } });

      const applyButton = screen.getByText(/Apply/);
      fireEvent.click(applyButton);

      expect(mockOnApplyOperation).toHaveBeenCalledWith({
        type: 'brightness',
        value: 25,
        timestamp: expect.any(Date),
      });
    });

    it('should reset brightness value when reset button is clicked', () => {
      render(
        <ToolControlPanel
          tool={brightnessTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '75' } });
      expect(screen.getByText('Brightness: 75')).toBeInTheDocument();

      const resetButton = screen.getByText(/Reset/);
      fireEvent.click(resetButton);

      expect(screen.getByText('Brightness: 0')).toBeInTheDocument();
    });
  });

  describe('Contrast Tool', () => {
    const contrastTool: EditorTool = {
      id: 'contrast',
      name: 'Contrast',
      icon: '🔆',
      type: 'contrast',
    };

    it('should render contrast controls', () => {
      render(
        <ToolControlPanel
          tool={contrastTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      expect(screen.getByText('Contrast')).toBeInTheDocument();
      expect(screen.getByText('Contrast: 0')).toBeInTheDocument();
    });
  });

  describe('Saturation Tool', () => {
    const saturationTool: EditorTool = {
      id: 'saturation',
      name: 'Saturation',
      icon: '🎨',
      type: 'saturation',
    };

    it('should render saturation controls', () => {
      render(
        <ToolControlPanel
          tool={saturationTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      expect(screen.getByText('Saturation')).toBeInTheDocument();
      expect(screen.getByText('Saturation: 100%')).toBeInTheDocument();
    });

    it('should reset saturation to 100% when reset is clicked', () => {
      render(
        <ToolControlPanel
          tool={saturationTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '150' } });
      expect(screen.getByText('Saturation: 150%')).toBeInTheDocument();

      const resetButton = screen.getByText(/Reset/);
      fireEvent.click(resetButton);

      expect(screen.getByText('Saturation: 100%')).toBeInTheDocument();
    });
  });

  describe('Rotate Tool', () => {
    const rotateTool: EditorTool = {
      id: 'rotate',
      name: 'Rotate',
      icon: '↻',
      type: 'rotate',
    };

    it('should render rotate controls', () => {
      render(
        <ToolControlPanel
          tool={rotateTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      expect(screen.getByText('Rotate')).toBeInTheDocument();
      expect(screen.getByText(/90° Left/)).toBeInTheDocument();
      expect(screen.getByText(/90° Right/)).toBeInTheDocument();
      expect(screen.getByText(/180°/)).toBeInTheDocument();
    });

    it('should call onApplyOperation with correct rotation when buttons are clicked', () => {
      render(
        <ToolControlPanel
          tool={rotateTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      // Test 90° left rotation
      const leftButton = screen.getByText(/90° Left/);
      fireEvent.click(leftButton);

      expect(mockOnApplyOperation).toHaveBeenCalledWith({
        type: 'rotate',
        value: { degrees: 270 },
        timestamp: expect.any(Date),
      });

      // Test 90° right rotation
      const rightButton = screen.getByText(/90° Right/);
      fireEvent.click(rightButton);

      expect(mockOnApplyOperation).toHaveBeenCalledWith({
        type: 'rotate',
        value: { degrees: 90 },
        timestamp: expect.any(Date),
      });

      // Test 180° rotation
      const flipButton = screen.getByText(/180°/);
      fireEvent.click(flipButton);

      expect(mockOnApplyOperation).toHaveBeenCalledWith({
        type: 'rotate',
        value: { degrees: 180 },
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Crop Tool', () => {
    const cropTool: EditorTool = {
      id: 'crop',
      name: 'Crop',
      icon: '✂️',
      type: 'crop',
    };

    it('should render crop controls', () => {
      render(
        <ToolControlPanel
          tool={cropTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      expect(screen.getByText('Crop')).toBeInTheDocument();
      expect(screen.getByText(/Click and drag on the image/)).toBeInTheDocument();
      expect(screen.getByText('Aspect Ratio Presets:')).toBeInTheDocument();
      expect(screen.getByText('1:1 Square')).toBeInTheDocument();
      expect(screen.getByText('4:3 Standard')).toBeInTheDocument();
      expect(screen.getByText('16:9 Widescreen')).toBeInTheDocument();
      expect(screen.getByText('3:2 Photo')).toBeInTheDocument();
    });
  });

  describe('Resize Tool', () => {
    const resizeTool: EditorTool = {
      id: 'resize',
      name: 'Resize',
      icon: '📏',
      type: 'resize',
    };

    it('should render resize controls', () => {
      render(
        <ToolControlPanel
          tool={resizeTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      expect(screen.getByText('Resize')).toBeInTheDocument();
      expect(screen.getByText('Scale: 100%')).toBeInTheDocument();
      expect(screen.getByText('Apply Resize')).toBeInTheDocument();
    });

    it('should update scale value when slider changes', () => {
      render(
        <ToolControlPanel
          tool={resizeTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '150' } });

      expect(screen.getByText('Scale: 150%')).toBeInTheDocument();
    });

    it('should call onApplyOperation when apply resize is clicked', () => {
      render(
        <ToolControlPanel
          tool={resizeTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '75' } });

      const applyButton = screen.getByText(/Apply Resize/);
      fireEvent.click(applyButton);

      expect(mockOnApplyOperation).toHaveBeenCalledWith({
        type: 'resize',
        value: 0.75,
        timestamp: expect.any(Date),
      });
    });

    it('should set preset values when preset buttons are clicked', () => {
      render(
        <ToolControlPanel
          tool={resizeTool}
          onApplyOperation={mockOnApplyOperation}
        />
      );

      const preset50Button = screen.getByText('50%');
      fireEvent.click(preset50Button);

      expect(screen.getByText('Scale: 50%')).toBeInTheDocument();

      const preset200Button = screen.getByText('200%');
      fireEvent.click(preset200Button);

      expect(screen.getByText('Scale: 200%')).toBeInTheDocument();
    });
  });
});