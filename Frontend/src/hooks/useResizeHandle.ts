import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizeHandleOptions {
  width: number;
  onWidthChange: (width: number) => void;
  minWidth: number;
  maxWidth: number;
  direction: 'left' | 'right';
}

export function useResizeHandle({ width, onWidthChange, minWidth, maxWidth, direction }: UseResizeHandleOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const startRef = useRef({ x: 0, w: 0, pointerId: -1 });

  const clampWidth = useCallback(
    (nextWidth: number) => Math.min(maxWidth, Math.max(minWidth, nextWidth)),
    [maxWidth, minWidth]
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    startRef.current.pointerId = -1;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (startRef.current.pointerId !== -1 && event.pointerId !== startRef.current.pointerId) return;

      const diff = event.clientX - startRef.current.x;
      const delta = direction === 'left' ? -diff : diff;
      onWidthChange(clampWidth(startRef.current.w + delta));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (startRef.current.pointerId !== -1 && event.pointerId !== startRef.current.pointerId) return;
      stopResizing();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [clampWidth, direction, isResizing, onWidthChange, stopResizing]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;

      event.preventDefault();
      startRef.current = {
        x: event.clientX,
        w: width,
        pointerId: event.pointerId,
      };
      setIsResizing(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    },
    [width]
  );

  return { isResizing, handlePointerDown };
}
