import { useReducer, useEffect, useCallback, useMemo } from 'react';
import {
  viewportReducer,
  fullViewportState,
  effectiveZoomTarget,
} from '@/utils/history/timelineViewportReducer';

/**
 * Local timeline zoom state for the history dock — no Redux.
 * Holds the visible window and the zoom target rectangle inside it.
 */
export function useTimelineViewport(sessionDurationUs: number) {
  const [state, dispatch] = useReducer(
    viewportReducer,
    sessionDurationUs,
    fullViewportState,
  );
  const zoomTarget = useMemo(() => effectiveZoomTarget(state), [state]);

  useEffect(() => {
    dispatch({ type: 'init', sessionDurationUs });
  }, [sessionDurationUs]);

  const zoomAround = useCallback(
    (anchorTimeUs: number, zoomFactor: number) =>
      dispatch({ type: 'zoom', anchorTimeUs, zoomFactor }),
    [],
  );
  const centerOn = useCallback(
    (timeUs: number) => dispatch({ type: 'center', timeUs }),
    [],
  );
  const panBy = useCallback(
    (deltaUs: number) => dispatch({ type: 'pan', deltaUs }),
    [],
  );
  const moveZoomTarget = useCallback(
    (deltaUs: number) => dispatch({ type: 'moveTarget', deltaUs }),
    [],
  );
  const resizeZoomTarget = useCallback(
    (edge: 'start' | 'end', timeUs: number) =>
      dispatch({ type: 'resizeTarget', edge, timeUs }),
    [],
  );
  const zoomToTarget = useCallback(
    () => dispatch({ type: 'zoomToTarget' }),
    [],
  );
  const setZoomTargetVisible = useCallback(
    (visible: boolean) => dispatch({ type: 'setTargetVisible', visible }),
    [],
  );

  return {
    viewport: state.viewport,
    zoomTarget,
    zoomTargetVisible: state.zoomTargetVisible,
    setZoomTargetVisible,
    zoomAround,
    centerOn,
    panBy,
    moveZoomTarget,
    resizeZoomTarget,
    zoomToTarget,
  };
}
