import type {
  TimelineEvent,
  TimelineEventType,
} from '@/services/historyService/types';
import type { TimelineViewport } from '@/utils/history/timelineViewport';
import {
  clusterVisibleEvents,
  getVisibleEvents,
  type PositionedEvent,
} from '@/utils/history/timelineViewportView';
import type {
  TimelineLaneId,
  TimelineLaneView,
} from './timelineViewModel.types';

export const LANE_ORDER: TimelineLaneId[] = ['errors', 'graph', 'config'];

export const LANE_LABELS: Record<TimelineLaneId, string> = {
  errors: 'Errors',
  graph: 'Graph',
  config: 'Config',
};

/** pid-reconfig and args-change are both per-filter config changes, not topology. */
export const EVENT_TYPE_TO_LANE: Record<TimelineEventType, TimelineLaneId> = {
  error: 'errors',
  warning: 'errors',
  'graph-change': 'graph',
  'pid-reconfig': 'config',
  'args-change': 'config',
};

export const CLUSTER_MIN_GAP_PERCENT = 2;

export function buildLanes(
  viewport: TimelineViewport,
  events: TimelineEvent[],
): TimelineLaneView[] {
  const eventsByLane: Record<TimelineLaneId, PositionedEvent[]> = {
    errors: [],
    graph: [],
    config: [],
  };
  for (const positioned of getVisibleEvents(viewport, events)) {
    eventsByLane[EVENT_TYPE_TO_LANE[positioned.event.type]].push(positioned);
  }
  return LANE_ORDER.map((laneId) => ({
    id: laneId,
    label: LANE_LABELS[laneId],
    items: clusterVisibleEvents(eventsByLane[laneId], CLUSTER_MIN_GAP_PERCENT),
  }));
}
