import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

export function CoverHScroll({
  height,
  gap,
  children,
}: {
  height: number | `${number}%`;
  gap: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth + 1) return;
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (delta === 0) return;
      node.scrollLeft += delta;
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScroll: node.scrollLeft,
        moved: false,
      };
      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.startX;
      if (!state.moved && Math.abs(dx) < 6) return;
      state.moved = true;
      suppressClick.current = true;
      node.style.cursor = 'grabbing';
      node.scrollLeft = state.startScroll - dx;
      event.preventDefault();
    };

    const endDrag = (event: PointerEvent) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      drag.current = null;
      node.style.cursor = 'grab';
      try {
        if (node.hasPointerCapture(event.pointerId)) {
          node.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* ignore */
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', endDrag);
    node.addEventListener('click', onClickCapture, true);

    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endDrag);
      node.removeEventListener('pointercancel', endDrag);
      node.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  const fill = height === '100%';

  return (
    <div
      style={{
        ...webShell,
        height,
        flexShrink: fill ? 1 : 0,
        ...(fill ? { flex: 1, minHeight: 0 } : null),
      }}
      data-cover-scroll-shell="1">
      <div ref={ref} data-cover-scroll="1" style={{ ...webScroll, height }}>
        <div style={{ ...webRow, minHeight: height, gap }}>{children}</div>
      </div>
    </div>
  );
}

const webShell: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  flexShrink: 0,
};

const webScroll: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
  touchAction: 'pan-x',
  cursor: 'grab',
};

const webRow: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'flex-start',
  width: 'max-content',
  minWidth: '100%',
  boxSizing: 'border-box',
};
