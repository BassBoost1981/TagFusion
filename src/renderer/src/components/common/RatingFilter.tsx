import React from 'react';
import { StarRating } from './StarRating';
import './RatingFilter.css';

interface RatingFilterProps {
  selectedRating?: number;
  onRatingChange: (rating: number | undefined) => void;
  label?: string;
  showClearButton?: boolean;
  className?: string;
}

export const RatingFilter: React.FC<RatingFilterProps> = ({
  selectedRating,
  onRatingChange,
  label = 'Minimum Rating',
  showClearButton = true,
  className = '',
}) => {
  const handleStarClick = (rating: number) => {
    // If clicking the same rating, clear it
    const newRating = selectedRating === rating ? undefined : rating;
    onRatingChange(newRating);
  };

  const handleClearClick = () => {
    onRatingChange(undefined);
  };

  return (
    <div className={`rating-filter ${className}`}>
      <div className="rating-filter-header">
        <label className="rating-filter-label">{label}</label>
        {showClearButton && selectedRating && (
          <button
            type="button"
            className="clear-rating-btn"
            onClick={handleClearClick}
            title="Clear rating filter"
          >
            ✕
          </button>
        )}
      </div>
      
      <div className="rating-filter-stars">
        {[1, 2, 3, 4, 5].map(rating => (
          <button
            key={rating}
            type="button"
            className={`rating-star-btn ${selectedRating && selectedRating >= rating ? 'active' : ''}`}
            onClick={() => handleStarClick(rating)}
            title={`${rating} star${rating > 1 ? 's' : ''} or higher`}
          >
            <span className="star-icon">⭐</span>
          </button>
        ))}
      </div>
      
      {selectedRating && (
        <div className="rating-filter-text">
          {selectedRating}+ star{selectedRating > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default RatingFilter;