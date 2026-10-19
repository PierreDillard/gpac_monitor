import type { TimelineViewport } from './timelineViewport';

const visibleEndUs = (viewport: TimelineViewport) =>
  viewport.visibleStartUs + viewport.visibleDurationUs;

/** Session time where Play starts: the playhead if visible, otherwise the visible window start. */
export function getPlayStartUs(
  viewport: TimelineViewport,
  playheadUs: number,
  isEnded: boolean,
): number {
  const isVisible =
    playheadUs >= viewport.visibleStartUs &&
    playheadUs <= visibleEndUs(viewport);
  return isVisible && !isEnded ? playheadUs : viewport.visibleStartUs;
}

/** Next visible window start once the playhead reaches the right edge; null otherwise. */
export function getPagedStartUs(
  viewport: TimelineViewport,
  playheadUs: number,
): number | null {
  const endUs = visibleEndUs(viewport);
  if (playheadUs < endUs || endUs >= viewport.sessionDurationUs) return null;
  return playheadUs;
}
