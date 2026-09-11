import { Resizable, ResizeCallbackData } from 'react-resizable';
import {
  TIMELINE_DOCK_HEIGHT_PX,
  EVENTS_PANEL_MIN_WIDTH_PX,
  EVENTS_PANEL_MAX_WIDTH_PX,
} from '../historyLayout';
import Timeline from './Timeline';
import EventsFilter from './EventsFilter';
import type { TimelineFilter } from './EventsFilter';
import EventJournal from './EventJournal';
import HistoryTimelineLanes from './HistoryTimelineLanes';
import HistoryTimelineRightPanel from './HistoryTimelineRightPanel';
import type { TimelineEvent } from '@/services/historyService/types';
import type { TimelineViewport } from '@/utils/history/timelineViewport';
import type { TimelineLaneView } from './timelineViewModel.types';
import {
  renderVerticalResizeHandle,
  renderHorizontalResizeHandle,
} from './resizeHandles';

interface HistoryTimelineDockProps {
  dockHeight: number;
  maxDockHeight: number;
  onDockResize: (height: number) => void;
  panelWidth: number;
  onPanelResize: (width: number) => void;
  activeFilter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  journalEvents: TimelineEvent[];
  sessionStartUs: number;
  currentTimeUs: number;
  durationUs: number;
  viewport: TimelineViewport;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (targetTimestampUs: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  lanes: TimelineLaneView[];
  elapsedUs: number;
  playheadPercent: number;
}

const HistoryTimelineDock = ({
  dockHeight,
  maxDockHeight,
  onDockResize,
  panelWidth,
  onPanelResize,
  activeFilter,
  onFilterChange,
  journalEvents,
  sessionStartUs,
  currentTimeUs,
  durationUs,
  viewport,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  lanes,
  elapsedUs,
  playheadPercent,
}: HistoryTimelineDockProps) => (
  <div className="relative" style={{ height: TIMELINE_DOCK_HEIGHT_PX }}>
    <Resizable
      axis="y"
      width={0}
      height={dockHeight}
      resizeHandles={['n']}
      minConstraints={[0, TIMELINE_DOCK_HEIGHT_PX]}
      maxConstraints={[0, maxDockHeight]}
      handle={renderVerticalResizeHandle}
      onResize={(_event, { size }: ResizeCallbackData) =>
        onDockResize(size.height)
      }
    >
      <div
        className="z-50 flex flex-row items-stretch border-t border-t-timeline-premium bg-gradient-to-b from-monitor-timeline-premiumFrom to-monitor-timeline-premiumTo"
        style={{
          height: dockHeight,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <Resizable
          axis="x"
          width={panelWidth}
          height={0}
          resizeHandles={['e']}
          minConstraints={[EVENTS_PANEL_MIN_WIDTH_PX, 0]}
          maxConstraints={[EVENTS_PANEL_MAX_WIDTH_PX, 0]}
          handle={renderHorizontalResizeHandle}
          onResize={(_event, { size }: ResizeCallbackData) =>
            onPanelResize(size.width)
          }
        >
          <div
            className="shrink-0 flex flex-col border-r border-history-border overflow-hidden"
            style={{ width: panelWidth }}
          >
            <div className="shrink-0 py-1 border-b border-white/5">
              <EventsFilter active={activeFilter} onChange={onFilterChange} />
            </div>
            {dockHeight > TIMELINE_DOCK_HEIGHT_PX && (
              <EventJournal
                events={journalEvents}
                sessionStartUs={sessionStartUs}
                onSeek={onSeek}
              />
            )}
          </div>
        </Resizable>
        <div className="flex-1 px-3 pt-5 min-w-0 overflow-hidden">
          <Timeline
            currentTimeUs={currentTimeUs}
            durationUs={durationUs}
            sessionStartUs={sessionStartUs}
            viewport={viewport}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPause={onPause}
            onSeek={onSeek}
            belowRailContent={
              <HistoryTimelineLanes
                lanes={lanes}
                playheadPercent={playheadPercent}
                onSeek={(sessionTimeUs) =>
                  onSeek(sessionStartUs + sessionTimeUs)
                }
              />
            }
          />
        </div>
        <HistoryTimelineRightPanel
          elapsedUs={elapsedUs}
          durationUs={durationUs}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
        />
      </div>
    </Resizable>
  </div>
);

export default HistoryTimelineDock;
