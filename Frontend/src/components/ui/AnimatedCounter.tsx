import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

// Animates the number via direct textContent updates (no re-render per frame).
// Animiert die Zahl per textContent — kein React-Re-Render pro Frame.
export function AnimatedCounter({ value, duration = 500, className = '' }: AnimatedCounterProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    prevValue.current = value;

    const controls = animate(from, value, {
      duration: duration / 1000,
      ease: 'linear',
      onUpdate: (n) => {
        if (spanRef.current) spanRef.current.textContent = String(Math.round(n));
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span ref={spanRef} className={className}>
      {Math.round(prevValue.current)}
    </span>
  );
}
