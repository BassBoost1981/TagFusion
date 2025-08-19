import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MediaFile } from '../../../../types/global';
import './VideoPlayer.css';

interface VideoPlayerProps {
  file: MediaFile;
  autoPlay?: boolean;
  controls?: boolean;
  onLoadedMetadata?: (metadata: { duration: number; width: number; height: number }) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  file,
  autoPlay = false,
  controls = true,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  onError,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle video events
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      setDuration(video.duration);
      setIsLoading(false);
      
      if (onLoadedMetadata) {
        onLoadedMetadata({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      }
    }
  }, [onLoadedMetadata]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
    }
  }, [onTimeUpdate]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (onEnded) {
      onEnded();
    }
  }, [onEnded]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const errorMessage = video.error ? 
      `Video error: ${video.error.message} (Code: ${video.error.code})` : 
      'Unknown video error';
    
    setError(errorMessage);
    setIsLoading(false);
    
    if (onError) {
      onError(errorMessage);
    }
  }, [onError]);

  // Control functions
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Failed to play video:', err);
          setError('Failed to play video');
        });
      }
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (!isFullscreen) {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }
  }, [isFullscreen]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayPause, seek, currentTime, duration, handleVolumeChange, volume, toggleMute, toggleFullscreen]);

  // Format time for display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`video-player ${className} ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="video-container">
        <video
          ref={videoRef}
          src={`file://${file.path}`}
          autoPlay={autoPlay}
          controls={false} // We'll use custom controls
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleError}
          className="video-element"
        />
        
        {isLoading && (
          <div className="video-loading">
            <div className="loading-spinner"></div>
            <span>Loading video...</span>
          </div>
        )}
        
        {error && (
          <div className="video-error">
            <div className="error-icon">⚠️</div>
            <span>{error}</span>
          </div>
        )}
      </div>

      {controls && !error && (
        <div className="video-controls">
          <div className="controls-row">
            {/* Play/Pause Button */}
            <button
              className="control-button play-pause"
              onClick={togglePlayPause}
              disabled={isLoading}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Progress Bar */}
            <div className="progress-container">
              <input
                type="range"
                className="progress-bar"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                disabled={isLoading}
              />
              <div className="time-display">
                <span className="current-time">{formatTime(currentTime)}</span>
                <span className="separator">/</span>
                <span className="total-time">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Volume Controls */}
            <div className="volume-controls">
              <button
                className="control-button volume-button"
                onClick={toggleMute}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                className="volume-slider"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                title="Volume"
              />
            </div>

            {/* Fullscreen Button */}
            <button
              className="control-button fullscreen-button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? '⏹️' : '⛶'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;