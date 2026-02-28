import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, X } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  isSaving: boolean;
  onRate: (e: React.MouseEvent, starIndex: number) => void;
  onClear: (e: React.MouseEvent) => void;
}

export function StarRating({ rating, isSaving, onRate, onClear }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [sparkleIndex, setSparkleIndex] = useState<number | null>(null);

  const handleRate = (e: React.MouseEvent, starIndex: number) => {
    setSparkleIndex(starIndex);
    setTimeout(() => setSparkleIndex(null), 600);
    onRate(e, starIndex);
  };

  return (
    <div className="flex items-center justify-center gap-0.5 flex-shrink-0" onMouseLeave={() => setHoverRating(0)}>
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const isFilled = starIndex < (hoverRating || rating);
        const isSparkle = sparkleIndex === starIndex;
        return (
          <motion.button
            key={starIndex}
            onClick={(e) => handleRate(e, starIndex)}
            onMouseEnter={() => setHoverRating(starIndex + 1)}
            className="p-1 transition-all relative"
            whileHover={{ scale: 1.2, y: -1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              filter: isFilled ? 'drop-shadow(0 1px 2px rgba(6,182,212,0.5))' : 'none',
            }}
          >
            <Star
              size={16}
              data-testid="star-icon"
              className={isFilled ? 'text-cyan-400' : 'text-white/40'}
              fill={isFilled ? 'currentColor' : 'none'}
              strokeWidth={2}
            />
            {/* Sparkle particles */}
            {isSparkle && (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-cyan-400"
                    initial={{
                      opacity: 1,
                      scale: 1,
                      x: 0,
                      y: 0,
                    }}
                    animate={{
                      opacity: 0,
                      scale: 0,
                      x: [0, i === 0 ? -12 : i === 1 ? 12 : i === 2 ? 0 : 0],
                      y: [0, i === 0 ? -6 : i === 1 ? -6 : i === 2 ? -12 : 8],
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      left: '50%',
                      top: '50%',
                      boxShadow: '0 0 4px 2px rgba(6,182,212,0.6)',
                    }}
                  />
                ))}
              </>
            )}
          </motion.button>
        );
      })}
      {/* Clear rating button */}
      {rating > 0 && (
        <motion.button
          onClick={onClear}
          disabled={isSaving}
          className="ml-1 p-1 rounded hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-50"
          title="Rating löschen"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
        >
          <X size={12} />
        </motion.button>
      )}
    </div>
  );
}
