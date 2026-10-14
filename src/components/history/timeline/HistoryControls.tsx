import { useMemo, useState } from 'react';
import { useDataSource } from '@/services/dataSource/DataSourceContext';
import { usePlayerState } from '@/services/historyService/usePlayerState';
import { useTimelineEvents } from '@/services/historyService/useTimelineEvents';
import {
  TIMELINE_DOCK_DEFAULT_HEIGHT_PX,
  EVENTS_PANEL_WIDTH_PX,
} from '../historyLayout';
import type { TimelineFilter } from './EventsFilter';
import { useTimelineViewport } from '../hooks/useTimelineViewport';
import { useTimelineLanes } from '../hooks/useTimelineLanes';
import { useReplayNotifications } from '../hooks/useReplayNotifications';
import { MIN_VISIBLE_DURATION_US } from '@/utils/history/timelineViewport';
import { getCursorPercent } from '@/utils/history/timelineViewportView';
import HistoryTimelineDock from './HistoryTimelineDock';

const HistoryControls = () => {
  const { mode } = useDataSource();
  const {
    state,
    currentTimeUs,
    durationUs,
    sessionStartUs,
    play,
    pause,
    seek,
  } = usePlayerState();
  useReplayNotifications();
  const [dockHeight, setDockHeight] = useState(TIMELINE_DOCK_DEFAULT_HEIGHT_PX);
  const [panelWidth, setPanelWidth] = useState(EVENTS_PANEL_WIDTH_PX);

  const maxDockHeight = useMemo(() => Math.round(window.innerHeight * 0.6), []);
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const allEvents = useTimelineEvents();
  const { viewport, zoomAround, centerOn, panBy } =
    useTimelineViewport(durationUs);

  const filteredEvents = useMemo(
    () =>
      activeFilter === 'all'
        ? allEvents
        : allEvents.filter((event) => event.type === activeFilter),
    [allEvents, activeFilter],
  );

  const playheadSessionUs = currentTimeUs - sessionStartUs;
  const lanes = useTimelineLanes(filteredEvents, viewport);
  const elapsedUs = Math.max(0, Math.min(playheadSessionUs, durationUs));
  const playheadPercent = getCursorPercent(viewport, elapsedUs);

  const windowCenterUs =
    viewport.visibleStartUs + viewport.visibleDurationUs / 2;
  const canZoomIn = viewport.visibleDurationUs > MIN_VISIBLE_DURATION_US;
  const canZoomOut = viewport.visibleDurationUs < viewport.sessionDurationUs;

  if (mode !== 'history') return null;

  return (
    <HistoryTimelineDock
      dockHeight={dockHeight}
      maxDockHeight={maxDockHeight}
      onDockResize={setDockHeight}
      panelWidth={panelWidth}
      onPanelResize={setPanelWidth}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      journalEvents={filteredEvents}
      sessionStartUs={sessionStartUs}
      currentTimeUs={currentTimeUs}
      durationUs={durationUs}
      viewport={viewport}
      isPlaying={state === 'playing'}
      onPlay={play}
      onPause={pause}
      onSeek={seek}
      onSeekToSessionTime={(sessionTimeUs) => {
        seek(sessionStartUs + sessionTimeUs);
        centerOn(sessionTimeUs);
      }}
      lanes={lanes}
      elapsedUs={elapsedUs}
      playheadPercent={playheadPercent}
      onPan={panBy}
      onZoomIn={() => zoomAround(windowCenterUs, 0.5)}
      onZoomOut={() => zoomAround(windowCenterUs, 2)}
      canZoomIn={canZoomIn}
      canZoomOut={canZoomOut}
    />
  );
};

export default HistoryControls;
