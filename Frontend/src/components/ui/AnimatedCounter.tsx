import { useEffect, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 500, className = '' }: AnimatedCounterProps) {
  const prevValue = useRef(0);

  const { number } = useSpring({
    from: { number: prevValue.current },
    to: { number: value },
    config: { duration },
  });

  useEffect(() => {
    prevValue.current = value;
  }, [value]);

  return <animated.span className={className}>{number.to((n) => Math.round(n))}</animated.span>;
}
