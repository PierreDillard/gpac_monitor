import * as Slider from '@radix-ui/react-slider';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  estimateTickLabelWidthPx,
  type TimeRuler,
} from '@/utils/history/generateTimeTicks';
import { CLICK_MAX_DISTANCE_PX } from '../historyLayout';

interface SeekBarProps {
  progressPercent: number;
  onSeekPositionChange: (positionPercent: number) => void;
  formatTooltip: (positionPercent: number) => string;
  disabled?: boolean;
  timeRuler?: TimeRuler;
  onRulerDrag?: (deltaPixels: number, rulerWidthPx: number) => void;
  onRulerClick?: () => void;
  railOverlay?: ReactNode;
}

const SeekBar = ({
  progressPercent,
  onSeekPositionChange,
  formatTooltip,
  disabled,
  timeRuler,
  onRulerDrag,
  onRulerClick,
  railOverlay,
}: SeekBarProps) => {
  const rulerDragRef = useRef<{ startX: number; lastX: number } | null>(null);
  const endRulerDrag = () => {
    rulerDragRef.current = null;
  };
  const [previewPercent, setPreviewPercent] = useState<number | null>(null);
  const [pendingSeekPercent, setPendingSeekPercent] = useState<number | null>(
    null,
  );
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);

  useEffect(() => {
    if (
      pendingSeekPercent !== null &&
      Math.abs(progressPercent - pendingSeekPercent) < 0.05
    ) {
      setPendingSeekPercent(null);
    }
  }, [progressPercent, pendingSeekPercent]);

  const displayPercent =
    previewPercent ?? pendingSeekPercent ?? progressPercent;
  const capsulePercent = previewPercent ?? hoverPercent ?? displayPercent;

  return (
    <div className="relative flex-1 bg-white/[0.04] rounded-sm border-y border-white/5">
      <div
        className="absolute -top-5 -translate-x-1/2 text-gray-200 text-[0.714rem] whitespace-nowrap tabular-nums z-10 bg-black/30 px-1 rounded-sm pointer-events-none"
        style={{ left: `${capsulePercent}%` }}
      >
        {formatTooltip(capsulePercent)}
      </div>
      <Slider.Root
        min={0}
        max={100}
        step={0.01}
        value={[displayPercent]}
        onValueChange={([value]) => setPreviewPercent(value)}
        onValueCommit={([value]) => {
          setPreviewPercent(null);
          setPendingSeekPercent(value);
          onSeekPositionChange(value);
        }}
        disabled={disabled}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoverPercent(
            Math.max(
              0,
              Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
            ),
          );
        }}
        onMouseLeave={() => setHoverPercent(null)}
        className={`relative flex items-center w-full h-8 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}
      >
        <Slider.Track className="relative flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
          <Slider.Range className="absolute h-full bg-history/80" />
        </Slider.Track>
        <Slider.Thumb className="block w-0.5 h-6 rounded-full bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-history" />
      </Slider.Root>
      {railOverlay && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {railOverlay}
        </div>
      )}

      {timeRuler && (
        <div
          className="relative cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            rulerDragRef.current = {
              startX: event.clientX,
              lastX: event.clientX,
            };
          }}
          onPointerMove={(event) => {
            const drag = rulerDragRef.current;
            if (!drag) return;
            const deltaPixels = event.clientX - drag.lastX;
            drag.lastX = event.clientX;
            onRulerDrag?.(
              deltaPixels,
              event.currentTarget.getBoundingClientRect().width,
            );
          }}
          onPointerUp={(event) => {
            const drag = rulerDragRef.current;
            endRulerDrag();
            if (
              drag &&
              Math.abs(event.clientX - drag.startX) < CLICK_MAX_DISTANCE_PX
            )
              onRulerClick?.();
          }}
          onPointerCancel={endRulerDrag}
        >
          <div
            className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/30 pointer-events-none z-10"
            style={{ left: `${displayPercent}%` }}
          />
          <div className="relative h-2">
            {timeRuler.minor.map((tick) => (
              <div
                key={tick.positionPercent}
                className="absolute bottom-0 w-px h-1.5 bg-white/20 pointer-events-none"
                style={{ left: `${tick.positionPercent}%` }}
              />
            ))}
            {timeRuler.major.map((tick) => (
              <div
                key={tick.positionPercent}
                className="absolute bottom-0 w-px h-3 bg-white/35 pointer-events-none"
                style={{ left: `${tick.positionPercent}%` }}
              />
            ))}
          </div>
          {timeRuler.major.length > 0 && (
            <div className="relative h-7">
              {timeRuler.major.map((tick) => (
                <span
                  key={tick.positionPercent}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-[0.643rem] tabular-nums text-gray-300 pointer-events-none select-none"
                  style={{
                    left: `clamp(${estimateTickLabelWidthPx(tick.label) / 2}px, ${tick.positionPercent}%, calc(100% - ${estimateTickLabelWidthPx(tick.label) / 2}px))`,
                  }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeekBar;
