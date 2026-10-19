import { useRef } from 'react';
import type { PointerEvent } from 'react';
import type { TimelineViewport } from '@/utils/history/timelineViewport';
import type { TimeRange } from '@/utils/history/zoomTargetRange';
import { toPercent } from '@/utils/history/timelineViewportView';
import { CLICK_MAX_DISTANCE_PX } from '../historyLayout';

type DragMode = 'move' | 'start' | 'end';

interface ZoomTargetOverlayProps {
  viewport: TimelineViewport;
  zoomTarget: TimeRange;
  onMove: (deltaUs: number) => void;
  onResizeEdge: (edge: 'start' | 'end', timeUs: number) => void;
  onHide: () => void;
}

interface DragState {
  mode: DragMode;
  startClientX: number;
  lastTimeUs: number;
}

const ZoomTargetOverlay = ({
  viewport,
  zoomTarget,
  onMove,
  onResizeEdge,
  onHide,
}: ZoomTargetOverlayProps) => {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const pointerToTimeUs = (clientX: number): number => {
    const rail = railRef.current?.getBoundingClientRect();
    if (!rail || rail.width <= 0) return viewport.visibleStartUs;
    return (
      viewport.visibleStartUs +
      ((clientX - rail.left) / rail.width) * viewport.visibleDurationUs
    );
  };

  const startDrag = (mode: DragMode) => (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      startClientX: event.clientX,
      lastTimeUs: pointerToTimeUs(event.clientX),
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const timeUs = pointerToTimeUs(event.clientX);
    if (drag.mode === 'move') onMove(timeUs - drag.lastTimeUs);
    else onResizeEdge(drag.mode, timeUs);
    drag.lastTimeUs = timeUs;
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const isClick =
      drag?.mode === 'move' &&
      Math.abs(event.clientX - drag.startClientX) < CLICK_MAX_DISTANCE_PX;
    endDrag();
    if (isClick) onHide();
  };

  const dragHandlers = {
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: endDrag,
  };

  const leftPercent = toPercent(zoomTarget.startUs, viewport);
  const widthPercent =
    (zoomTarget.durationUs / viewport.visibleDurationUs) * 100;

  return (
    <div ref={railRef} className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-y-0 rounded-sm border border-rose-500 bg-rose-400/10 touch-none select-none"
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
      >
        <div
          className="absolute inset-y-0 left-0 w-0.5 bg-rose-500 cursor-ew-resize pointer-events-auto"
          aria-label="Zoom range start"
          onPointerDown={startDrag('start')}
          {...dragHandlers}
        />
        <div
          className="absolute top-8 bottom-0 inset-x-1 cursor-grab active:cursor-grabbing pointer-events-auto"
          aria-label="Move zoom range"
          onPointerDown={startDrag('move')}
          {...dragHandlers}
        />
        <div
          className="absolute inset-y-0 right-0 w-0.5 bg-rose-500 cursor-ew-resize pointer-events-auto"
          aria-label="Zoom range end"
          onPointerDown={startDrag('end')}
          {...dragHandlers}
        />
      </div>
    </div>
  );
};

export default ZoomTargetOverlay;
