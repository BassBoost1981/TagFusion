import React from 'react';
import './StarRating.css';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  interactive?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  interactive = false,
  size = 'medium',
  showLabel = false,
  onRatingChange,
  className = '',
}) => {
  const handleStarClick = (starRating: number) => {
    if (interactive && onRatingChange) {
      // If clicking the same rating, clear it (set to 0)
      const newRating = rating === starRating ? 0 : starRating;
      onRatingChange(newRating);
    }
  };

  const handleStarHover = (starRating: number) => {
    // Could implement hover preview here if needed
  };

  const renderStar = (starIndex: number) => {
    const starRating = starIndex + 1;
    const isFilled = starRating <= rating;
    const isInteractive = interactive && onRatingChange;

    return (
      <button
        key={starIndex}
        type="button"
        className={`star ${isFilled ? 'filled' : 'empty'} ${isInteractive ? 'interactive' : 'readonly'}`}
        onClick={isInteractive ? () => handleStarClick(starRating) : undefined}
        onMouseEnter={isInteractive ? () => handleStarHover(starRating) : undefined}
        disabled={!isInteractive}
        title={isInteractive ? `Rate ${starRating} star${starRating > 1 ? 's' : ''}` : `${starRating} star${starRating > 1 ? 's' : ''}`}
        aria-label={`${starRating} star${starRating > 1 ? 's' : ''}`}
      >
        <span className="star-icon">⭐</span>
      </button>
    );
  };

  return (
    <div className={`star-rating ${size} ${className}`}>
      <div className="stars-container">
        {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
      </div>
      {showLabel && (
        <span className="rating-label">
          {rating > 0 ? `${rating}/${maxRating}` : 'No rating'}
        </span>
      )}
    </div>
  );
};

export default StarRating;