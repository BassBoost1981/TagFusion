# Common Components

This directory contains reusable UI components that can be used throughout the application.

## StarRating Component

A flexible star rating component that supports both display and interactive modes.

### Features
- Display ratings from 0-5 stars
- Interactive mode for rating input
- Multiple sizes (small, medium, large)
- Optional rating label display
- Keyboard accessible
- Customizable styling

### Usage
```tsx
import { StarRating } from './StarRating';

// Display only
<StarRating rating={4} />

// Interactive rating input
<StarRating 
  rating={3} 
  interactive={true} 
  onRatingChange={(rating) => console.log(rating)}
/>

// With label and custom size
<StarRating 
  rating={5} 
  size="large" 
  showLabel={true}
/>
```

## RatingFilter Component

A specialized rating filter component for use in search/filter interfaces.

### Features
- Minimum rating selection (1-5 stars)
- Clear filter functionality
- Visual feedback for selected rating
- Customizable labels
- Compact design for filter panels

### Usage
```tsx
import { RatingFilter } from './RatingFilter';

<RatingFilter
  selectedRating={3}
  onRatingChange={(rating) => setMinRating(rating)}
  label="Minimum Rating"
  showClearButton={true}
/>
```

## Integration

Both components are integrated into:
- **PropertiesPanel**: For displaying and editing file ratings
- **AdvancedFilters**: For filtering files by minimum rating
- **Search functionality**: Rating-based search and filtering

The components work with the rating system backend through:
- **RatingService**: Handles rating CRUD operations
- **MetadataRepository**: Stores ratings in EXIF/XMP metadata
- **SearchService & FilterService**: Supports rating-based filtering