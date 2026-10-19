import SessionTimeIndicator from '@/components/common/SessionTimeIndicator';
import TimelineZoomControls from './TimelineZoomControls';
import SessionTimeInput from './SessionTimeInput';

interface HistoryTimelineRightPanelProps {
  elapsedUs: number;
  durationUs: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onSeekToSessionTime: (sessionTimeUs: number) => void;
}

const RIGHT_PANEL_WIDTH_PX = 184;

const HistoryTimelineRightPanel = ({
  elapsedUs,
  durationUs,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  onSeekToSessionTime,
}: HistoryTimelineRightPanelProps) => (
  <div
    className="shrink-0 flex flex-col gap-1.5 px-4 pt-5 border-l border-history-border"
    style={{ width: RIGHT_PANEL_WIDTH_PX }}
  >
    <SessionTimeIndicator elapsedUs={elapsedUs} durationUs={durationUs} />
    <SessionTimeInput
      durationUs={durationUs}
      onSeekToSessionTime={onSeekToSessionTime}
    />
    <div className="flex items-center gap-2">
      <span className="text-[0.688rem] uppercase tracking-wide text-gray-500">
        Zoom
      </span>
      <TimelineZoomControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
      />
    </div>
  </div>
);

export default HistoryTimelineRightPanel;
