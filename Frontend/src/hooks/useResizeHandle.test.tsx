import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResizeHandle } from './useResizeHandle';

function TestResizeHandle({
  width = 300,
  minWidth = 200,
  maxWidth = 400,
  direction = 'right',
  onWidthChange = vi.fn(),
}: {
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  direction?: 'left' | 'right';
  onWidthChange?: (width: number) => void;
}) {
  const { isResizing, handlePointerDown } = useResizeHandle({
    width,
    onWidthChange,
    minWidth,
    maxWidth,
    direction,
  });

  return (
    <button data-testid="handle" data-resizing={isResizing} onPointerDown={handlePointerDown}>
      resize
    </button>
  );
}

describe('useResizeHandle', () => {
  it('clamps resized width to min and max bounds', () => {
    const onWidthChange = vi.fn();
    const { getByTestId } = render(
      <TestResizeHandle width={300} minWidth={200} maxWidth={400} direction="right" onWidthChange={onWidthChange} />
    );

    fireEvent.pointerDown(getByTestId('handle'), { clientX: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: -500, pointerId: 1 });
    fireEvent.pointerUp(document, { pointerId: 1 });

    expect(onWidthChange).toHaveBeenNthCalledWith(1, 400);
    expect(onWidthChange).toHaveBeenNthCalledWith(2, 200);
  });

  it('removes global listeners when the component unmounts during a drag', () => {
    const onWidthChange = vi.fn();
    const { getByTestId, unmount } = render(
      <TestResizeHandle width={300} direction="right" onWidthChange={onWidthChange} />
    );

    fireEvent.pointerDown(getByTestId('handle'), { clientX: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, pointerId: 1 });
    expect(onWidthChange).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.pointerMove(document, { clientX: 250, pointerId: 1 });

    expect(onWidthChange).toHaveBeenCalledTimes(1);
  });
});
