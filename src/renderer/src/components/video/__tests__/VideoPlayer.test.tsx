import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { VideoPlayer } from '../VideoPlayer';
import { MediaFile } from '../../../../../types/global';

// Mock HTML5 video element
const mockVideoElement = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  currentTime: 0,
  duration: 120,
  volume: 1,
  muted: false,
  videoWidth: 1920,
  videoHeight: 1080,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  requestFullscreen: vi.fn(),
};

// Mock document methods
Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true,
});

Object.defineProperty(document, 'exitFullscreen', {
  value: vi.fn(),
  writable: true,
});

// Mock React.useRef
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useRef: vi.fn(() => ({ current: mockVideoElement })),
  };
});

describe('VideoPlayer', () => {
  const mockFile: MediaFile = {
    path: '/test/video.mp4',
    name: 'test-video.mp4',
    extension: '.mp4',
    size: 1024000,
    dateModified: new Date('2024-01-01'),
    type: 'video'
  };

  const defaultProps = {
    file: mockFile,
    autoPlay: false,
    controls: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockVideoElement.currentTime = 0;
    mockVideoElement.duration = 120;
    mockVideoElement.volume = 1;
    mockVideoElement.muted = false;
  });

  it('should render video element with correct src', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    const video = screen.getByRole('application'); // video element
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', `file://${mockFile.path}`);
  });

  it('should render controls when controls prop is true', () => {
    render(<VideoPlayer {...defaultProps} controls={true} />);
    
    expect(screen.getByTitle(/Play \(Space\)/)).toBeInTheDocument();
    expect(screen.getByTitle(/Mute \(M\)/)).toBeInTheDocument();
    expect(screen.getByTitle(/Fullscreen \(F\)/)).toBeInTheDocument();
  });

  it('should not render controls when controls prop is false', () => {
    render(<VideoPlayer {...defaultProps} controls={false} />);
    
    expect(screen.queryByTitle(/Play \(Space\)/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Mute \(M\)/)).not.toBeInTheDocument();
  });

  it('should toggle play/pause when play button is clicked', async () => {
    render(<VideoPlayer {...defaultProps} />);
    
    const playButton = screen.getByTitle(/Play \(Space\)/);
    fireEvent.click(playButton);
    
    expect(mockVideoElement.play).toHaveBeenCalled();
  });

  it('should handle play/pause with spacebar', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    fireEvent.keyDown(document, { code: 'Space' });
    
    expect(mockVideoElement.play).toHaveBeenCalled();
  });

  it('should seek with arrow keys', () => {
    mockVideoElement.currentTime = 30;
    mockVideoElement.duration = 120;
    
    render(<VideoPlayer {...defaultProps} />);
    
    fireEvent.keyDown(document, { code: 'ArrowLeft' });
    expect(mockVideoElement.currentTime).toBe(20); // 30 - 10
    
    fireEvent.keyDown(document, { code: 'ArrowRight' });
    expect(mockVideoElement.currentTime).toBe(40); // 30 + 10
  });

  it('should adjust volume with arrow keys', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    fireEvent.keyDown(document, { code: 'ArrowUp' });
    expect(mockVideoElement.volume).toBe(1); // Already at max
    
    mockVideoElement.volume = 0.5;
    fireEvent.keyDown(document, { code: 'ArrowDown' });
    expect(mockVideoElement.volume).toBe(0.4);
  });

  it('should toggle mute with M key', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    fireEvent.keyDown(document, { code: 'KeyM' });
    expect(mockVideoElement.muted).toBe(true);
  });

  it('should toggle fullscreen with F key', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    fireEvent.keyDown(document, { code: 'KeyF' });
    expect(mockVideoElement.requestFullscreen).toHaveBeenCalled();
  });

  it('should handle volume slider change', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    const volumeSlider = screen.getByTitle('Volume');
    fireEvent.change(volumeSlider, { target: { value: '0.7' } });
    
    expect(mockVideoElement.volume).toBe(0.7);
  });

  it('should handle progress bar change', () => {
    mockVideoElement.duration = 120;
    render(<VideoPlayer {...defaultProps} />);
    
    const progressBar = screen.getByRole('slider');
    fireEvent.change(progressBar, { target: { value: '60' } });
    
    expect(mockVideoElement.currentTime).toBe(60);
  });

  it('should call onLoadedMetadata when video metadata loads', () => {
    const onLoadedMetadata = vi.fn();
    render(<VideoPlayer {...defaultProps} onLoadedMetadata={onLoadedMetadata} />);
    
    // Simulate loadedmetadata event
    const video = screen.getByRole('application');
    fireEvent.loadedMetadata(video);
    
    expect(onLoadedMetadata).toHaveBeenCalledWith({
      duration: 120,
      width: 1920,
      height: 1080
    });
  });

  it('should call onTimeUpdate when video time updates', () => {
    const onTimeUpdate = vi.fn();
    mockVideoElement.currentTime = 45;
    
    render(<VideoPlayer {...defaultProps} onTimeUpdate={onTimeUpdate} />);
    
    // Simulate timeupdate event
    const video = screen.getByRole('application');
    fireEvent.timeUpdate(video);
    
    expect(onTimeUpdate).toHaveBeenCalledWith(45);
  });

  it('should call onEnded when video ends', () => {
    const onEnded = vi.fn();
    render(<VideoPlayer {...defaultProps} onEnded={onEnded} />);
    
    // Simulate ended event
    const video = screen.getByRole('application');
    fireEvent.ended(video);
    
    expect(onEnded).toHaveBeenCalled();
  });

  it('should call onError when video fails to load', () => {
    const onError = vi.fn();
    render(<VideoPlayer {...defaultProps} onError={onError} />);
    
    // Simulate error event
    const video = screen.getByRole('application');
    const errorEvent = new Event('error');
    Object.defineProperty(video, 'error', {
      value: { message: 'Network error', code: 2 },
      writable: true
    });
    
    fireEvent(video, errorEvent);
    
    expect(onError).toHaveBeenCalledWith('Video error: Network error (Code: 2)');
  });

  it('should format time correctly', () => {
    mockVideoElement.currentTime = 75; // 1:15
    mockVideoElement.duration = 3665; // 1:01:05
    
    render(<VideoPlayer {...defaultProps} />);
    
    expect(screen.getByText('1:15')).toBeInTheDocument();
    expect(screen.getByText('61:05')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    expect(screen.getByText('Loading video...')).toBeInTheDocument();
  });

  it('should show error state when video fails to load', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    // Simulate error
    const video = screen.getByRole('application');
    const errorEvent = new Event('error');
    Object.defineProperty(video, 'error', {
      value: { message: 'Format not supported', code: 4 },
      writable: true
    });
    
    fireEvent(video, errorEvent);
    
    expect(screen.getByText('Format not supported')).toBeInTheDocument();
  });

  it('should update play button icon based on playing state', async () => {
    render(<VideoPlayer {...defaultProps} />);
    
    // Initially should show play icon
    expect(screen.getByTitle(/Play \(Space\)/)).toBeInTheDocument();
    
    // Simulate play event
    const video = screen.getByRole('application');
    fireEvent.play(video);
    
    await waitFor(() => {
      expect(screen.getByTitle(/Pause \(Space\)/)).toBeInTheDocument();
    });
  });

  it('should update volume icon based on volume level', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    // Test different volume levels
    mockVideoElement.volume = 1;
    mockVideoElement.muted = false;
    expect(screen.getByTitle(/Mute \(M\)/)).toBeInTheDocument();
    
    mockVideoElement.volume = 0.3;
    // Volume icon should change based on level
    
    mockVideoElement.muted = true;
    // Should show muted icon
  });

  it('should handle autoPlay prop', () => {
    render(<VideoPlayer {...defaultProps} autoPlay={true} />);
    
    const video = screen.getByRole('application');
    expect(video).toHaveAttribute('autoPlay');
  });

  it('should apply custom className', () => {
    render(<VideoPlayer {...defaultProps} className="custom-class" />);
    
    const container = screen.getByRole('application').closest('.video-player');
    expect(container).toHaveClass('custom-class');
  });

  it('should handle fullscreen change events', () => {
    render(<VideoPlayer {...defaultProps} />);
    
    // Simulate entering fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      value: mockVideoElement,
      writable: true,
    });
    
    fireEvent(document, new Event('fullscreenchange'));
    
    // Should update fullscreen state
    expect(screen.getByTitle(/Exit Fullscreen \(F\)/)).toBeInTheDocument();
  });
});