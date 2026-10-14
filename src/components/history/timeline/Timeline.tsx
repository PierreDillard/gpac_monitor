import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { LuPause } from 'react-icons/lu';
import SeekBar from './SeekBar';
import { LANE_GUTTER_WIDTH_PX } from '../historyLayout';
import { formatCompactTime } from '@/utils/formatting/time';
import { generateWindowTimeTicks } from '@/utils/history/generateTimeTicks';
import {
  getCursorPercent,
  pixelsToDurationUs,
} from '@/utils/history/timelineViewportView';
import type { TimelineViewport } from '@/utils/history/timelineViewport';
import { FaCirclePlay } from 'react-icons/fa6';

interface TimelineProps {
  currentTimeUs: number;
  durationUs: number;
  sessionStartUs: number;
  viewport: TimelineViewport;
  isPlaying?: boolean;
  canPlay?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (targetTimestampUs: number) => void;
  onPan: (deltaUs: number) => void;
  belowRailContent?: ReactNode;
}

const Timeline = ({
  currentTimeUs,
  durationUs,
  sessionStartUs,
  viewport,
  isPlaying = false,
  canPlay = true,
  onPlay,
  onPause,
  onSeek,
  onPan,
  belowRailContent,
}: TimelineProps) => {
  const relativeTimeUs = currentTimeUs - sessionStartUs;
  const elapsedUs = Math.max(0, Math.min(relativeTimeUs, durationUs));
  const progressPercent = getCursorPercent(viewport, elapsedUs);
  const timeRuler = useMemo(
    () =>
      generateWindowTimeTicks(
        viewport.visibleStartUs,
        viewport.visibleDurationUs,
      ),
    [viewport],
  );

  const percentToSessionUs = useCallback(
    (positionPercent: number) =>
      viewport.visibleStartUs +
      (positionPercent / 100) * viewport.visibleDurationUs,
    [viewport],
  );

  const handleSeekPositionChange = useCallback(
    (positionPercent: number) => {
      onSeek(sessionStartUs + percentToSessionUs(positionPercent));
    },
    [sessionStartUs, percentToSessionUs, onSeek],
  );

  const formatTooltip = useCallback(
    (positionPercent: number) =>
      formatCompactTime(percentToSessionUs(positionPercent), true),
    [percentToSessionUs],
  );

  return (
    <div className="w-full">
      <div className="flex items-start">
        <div
          className="shrink-0 flex items-center justify-center h-8"
          style={{ width: LANE_GUTTER_WIDTH_PX }}
        >
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!canPlay}
            className="p-1 text-gray-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <LuPause className="w-6 h-6" />
            ) : (
              <FaCirclePlay className="w-6 h-6" />
            )}
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <SeekBar
            progressPercent={progressPercent}
            onSeekPositionChange={handleSeekPositionChange}
            formatTooltip={formatTooltip}
            disabled={!canPlay}
            timeRuler={timeRuler}
            onRulerDrag={(deltaPixels, rulerWidthPx) =>
              onPan(
                -pixelsToDurationUs(
                  deltaPixels,
                  rulerWidthPx,
                  viewport.visibleDurationUs,
                ),
              )
            }
          />
        </div>
      </div>
      {belowRailContent}
    </div>
  );
};

export default Timeline;
