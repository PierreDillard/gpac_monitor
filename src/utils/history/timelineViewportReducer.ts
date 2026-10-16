import {
  clampViewport,
  zoomViewportAroundTime,
  centerViewportOnTime,
  type TimelineViewport,
} from './timelineViewport';
import {
  centeredHalfRange,
  clampRangeToViewport,
  resizeRangeEdge,
  type TimeRange,
} from './zoomTargetRange';

export type ViewportAction =
  | { type: 'init'; sessionDurationUs: number }
  | { type: 'zoom'; anchorTimeUs: number; zoomFactor: number }
  | { type: 'center'; timeUs: number }
  | { type: 'pan'; deltaUs: number }
  | { type: 'moveTarget'; deltaUs: number }
  | { type: 'resizeTarget'; edge: 'start' | 'end'; timeUs: number }
  | { type: 'zoomToTarget' }
  | { type: 'setTargetVisible'; visible: boolean };

/** zoomTarget null = default target derived from the viewport (centeredHalfRange). */
export interface ViewportState {
  viewport: TimelineViewport;
  zoomTarget: TimeRange | null;
  zoomTargetVisible: boolean;
}

export function fullViewportState(sessionDurationUs: number): ViewportState {
  return {
    viewport: {
      sessionDurationUs,
      visibleStartUs: 0,
      visibleDurationUs: sessionDurationUs,
    },
    zoomTarget: null,
    zoomTargetVisible: true,
  };
}

export const effectiveZoomTarget = (state: ViewportState): TimeRange =>
  state.zoomTarget ?? centeredHalfRange(state.viewport);

function nextViewport(
  viewport: TimelineViewport,
  action: ViewportAction,
): TimelineViewport {
  switch (action.type) {
    case 'zoom':
      return zoomViewportAroundTime(
        viewport,
        action.anchorTimeUs,
        action.zoomFactor,
      );
    case 'center':
      return centerViewportOnTime(viewport, action.timeUs);
    case 'pan':
      return clampViewport({
        ...viewport,
        visibleStartUs: viewport.visibleStartUs + action.deltaUs,
      });
    default:
      return viewport;
  }
}

/** Any viewport change resets the zoom target to its default. */
export function viewportReducer(
  state: ViewportState,
  action: ViewportAction,
): ViewportState {
  const { viewport } = state;
  const zoomTarget = effectiveZoomTarget(state);
  switch (action.type) {
    case 'init':
      return fullViewportState(action.sessionDurationUs);
    case 'setTargetVisible':
      return { ...state, zoomTargetVisible: action.visible };
    case 'moveTarget':
      return {
        ...state,
        zoomTarget: clampRangeToViewport(viewport, {
          ...zoomTarget,
          startUs: zoomTarget.startUs + action.deltaUs,
        }),
      };
    case 'resizeTarget':
      return {
        ...state,
        zoomTarget: resizeRangeEdge(
          viewport,
          zoomTarget,
          action.edge,
          action.timeUs,
        ),
      };
    case 'zoomToTarget':
      return {
        ...state,
        viewport: clampViewport({
          ...viewport,
          visibleStartUs: zoomTarget.startUs,
          visibleDurationUs: zoomTarget.durationUs,
        }),
        zoomTarget: null,
      };
    default:
      return {
        ...state,
        viewport: nextViewport(viewport, action),
        zoomTarget: null,
      };
  }
}
