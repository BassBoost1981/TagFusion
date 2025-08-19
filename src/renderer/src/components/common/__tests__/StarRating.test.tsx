import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRating } from '../StarRating';

describe('StarRating', () => {
  it('should render correct number of stars', () => {
    render(<StarRating rating={3} maxRating={5} />);
    
    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
  });

  it('should display filled stars correctly', () => {
    render(<StarRating rating={3} maxRating={5} />);
    
    const stars = screen.getAllByRole('button');
    
    // First 3 stars should be filled
    expect(stars[0]).toHaveClass('filled');
    expect(stars[1]).toHaveClass('filled');
    expect(stars[2]).toHaveClass('filled');
    
    // Last 2 stars should be empty
    expect(stars[3]).toHaveClass('empty');
    expect(stars[4]).toHaveClass('empty');
  });

  it('should handle click events when interactive', () => {
    const onRatingChange = vi.fn();
    render(
      <StarRating 
        rating={2} 
        maxRating={5} 
        interactive={true} 
        onRatingChange={onRatingChange} 
      />
    );
    
    const stars = screen.getAllByRole('button');
    
    // Click on the 4th star
    fireEvent.click(stars[3]);
    
    expect(onRatingChange).toHaveBeenCalledWith(4);
  });

  it('should clear rating when clicking same star', () => {
    const onRatingChange = vi.fn();
    render(
      <StarRating 
        rating={3} 
        maxRating={5} 
        interactive={true} 
        onRatingChange={onRatingChange} 
      />
    );
    
    const stars = screen.getAllByRole('button');
    
    // Click on the 3rd star (currently selected)
    fireEvent.click(stars[2]);
    
    expect(onRatingChange).toHaveBeenCalledWith(0);
  });

  it('should not handle clicks when not interactive', () => {
    const onRatingChange = vi.fn();
    render(
      <StarRating 
        rating={2} 
        maxRating={5} 
        interactive={false} 
        onRatingChange={onRatingChange} 
      />
    );
    
    const stars = screen.getAllByRole('button');
    
    // Click on a star
    fireEvent.click(stars[3]);
    
    expect(onRatingChange).not.toHaveBeenCalled();
  });

  it('should display rating label when showLabel is true', () => {
    render(
      <StarRating 
        rating={4} 
        maxRating={5} 
        showLabel={true} 
      />
    );
    
    expect(screen.getByText('4/5')).toBeInTheDocument();
  });

  it('should display "No rating" when rating is 0 and showLabel is true', () => {
    render(
      <StarRating 
        rating={0} 
        maxRating={5} 
        showLabel={true} 
      />
    );
    
    expect(screen.getByText('No rating')).toBeInTheDocument();
  });

  it('should apply correct size classes', () => {
    const { container, rerender } = render(<StarRating rating={3} size="small" />);
    
    expect(container.firstChild).toHaveClass('small');
    
    rerender(<StarRating rating={3} size="large" />);
    expect(container.firstChild).toHaveClass('large');
  });

  it('should apply custom className', () => {
    const { container } = render(<StarRating rating={3} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});