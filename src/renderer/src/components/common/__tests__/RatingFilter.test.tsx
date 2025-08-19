import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RatingFilter } from '../RatingFilter';

describe('RatingFilter', () => {
  it('should render rating filter with stars', () => {
    render(<RatingFilter selectedRating={3} onRatingChange={vi.fn()} />);
    
    const stars = screen.getAllByRole('button').filter(btn => btn.textContent === '⭐');
    expect(stars).toHaveLength(5);
  });

  it('should show active stars correctly', () => {
    render(<RatingFilter selectedRating={3} onRatingChange={vi.fn()} />);
    
    const stars = screen.getAllByRole('button').filter(btn => btn.textContent === '⭐');
    
    // First 3 stars should be active
    expect(stars[0]).toHaveClass('active');
    expect(stars[1]).toHaveClass('active');
    expect(stars[2]).toHaveClass('active');
    
    // Last 2 stars should not be active
    expect(stars[3]).not.toHaveClass('active');
    expect(stars[4]).not.toHaveClass('active');
  });

  it('should handle star clicks', () => {
    const onRatingChange = vi.fn();
    render(<RatingFilter selectedRating={2} onRatingChange={onRatingChange} />);
    
    const stars = screen.getAllByRole('button').filter(btn => btn.textContent === '⭐');
    
    // Click on the 4th star
    fireEvent.click(stars[3]);
    
    expect(onRatingChange).toHaveBeenCalledWith(4);
  });

  it('should clear rating when clicking same star', () => {
    const onRatingChange = vi.fn();
    render(<RatingFilter selectedRating={3} onRatingChange={onRatingChange} />);
    
    const stars = screen.getAllByRole('button').filter(btn => btn.textContent === '⭐');
    
    // Click on the 3rd star (currently selected)
    fireEvent.click(stars[2]);
    
    expect(onRatingChange).toHaveBeenCalledWith(undefined);
  });

  it('should show clear button when rating is selected', () => {
    render(<RatingFilter selectedRating={3} onRatingChange={vi.fn()} />);
    
    expect(screen.getByTitle('Clear rating filter')).toBeInTheDocument();
  });

  it('should not show clear button when no rating is selected', () => {
    render(<RatingFilter selectedRating={undefined} onRatingChange={vi.fn()} />);
    
    expect(screen.queryByTitle('Clear rating filter')).not.toBeInTheDocument();
  });

  it('should handle clear button click', () => {
    const onRatingChange = vi.fn();
    render(<RatingFilter selectedRating={4} onRatingChange={onRatingChange} />);
    
    const clearButton = screen.getByTitle('Clear rating filter');
    fireEvent.click(clearButton);
    
    expect(onRatingChange).toHaveBeenCalledWith(undefined);
  });

  it('should show rating text when rating is selected', () => {
    render(<RatingFilter selectedRating={4} onRatingChange={vi.fn()} />);
    
    expect(screen.getByText('4+ stars')).toBeInTheDocument();
  });

  it('should show singular "star" for rating of 1', () => {
    render(<RatingFilter selectedRating={1} onRatingChange={vi.fn()} />);
    
    expect(screen.getByText('1+ star')).toBeInTheDocument();
  });

  it('should use custom label', () => {
    render(<RatingFilter selectedRating={3} onRatingChange={vi.fn()} label="Custom Label" />);
    
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('should hide clear button when showClearButton is false', () => {
    render(<RatingFilter selectedRating={3} onRatingChange={vi.fn()} showClearButton={false} />);
    
    expect(screen.queryByTitle('Clear rating filter')).not.toBeInTheDocument();
  });
});