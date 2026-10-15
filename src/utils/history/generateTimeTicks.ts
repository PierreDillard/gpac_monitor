import { formatCompactTime } from '@/utils/formatting/time';

export interface TimeTick {
  positionPercent: number;
  label: string;
}

export interface TimeRuler {
  major: TimeTick[];
  minor: Array<{ positionPercent: number }>;
}

const US = 1_000_000;

const NICE_INTERVALS_US = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600, 43200,
  86400, 172800, 432000, 604800,
].map((seconds) => seconds * US);

const DAY_US = 86400 * US;
const MAX_TICKS = 16;
const LABEL_CHAR_WIDTH_PX = 6;
const LABEL_GAP_PX = 12;

const formatTickLabel = (tickUs: number) =>
  formatCompactTime(tickUs, false, true);

export const estimateTickLabelWidthPx = (label: string) =>
  label.length * LABEL_CHAR_WIDTH_PX;

const fitsRulerWidth = (
  intervalUs: number,
  visibleEndUs: number,
  visibleDurationUs: number,
  rulerWidthPx: number,
) => {
  const lastTickUs = Math.floor(visibleEndUs / intervalUs) * intervalUs;
  const widestLabel =
    intervalUs % DAY_US === 0
      ? formatTickLabel(lastTickUs)
      : formatCompactTime(lastTickUs);
  const spacingPx = (intervalUs / visibleDurationUs) * rulerWidthPx;
  return spacingPx >= estimateTickLabelWidthPx(widestLabel) + LABEL_GAP_PX;
};

/** Ticks for an arbitrary visible window; labels are absolute session time. */
export function generateWindowTimeTicks(
  visibleStartUs: number,
  visibleDurationUs: number,
  rulerWidthPx?: number,
): TimeRuler {
  if (visibleDurationUs <= 0) return { major: [], minor: [] };

  const visibleEndUs = visibleStartUs + visibleDurationUs;
  const majorIntervalUs =
    NICE_INTERVALS_US.find(
      (candidate) =>
        visibleDurationUs / candidate <= MAX_TICKS &&
        (rulerWidthPx === undefined ||
          fitsRulerWidth(
            candidate,
            visibleEndUs,
            visibleDurationUs,
            rulerWidthPx,
          )),
    ) ?? NICE_INTERVALS_US[NICE_INTERVALS_US.length - 1];

  const minorIntervalUs = majorIntervalUs / 5;
  const hasMinor = minorIntervalUs >= US;
  const toPercent = (tickUs: number) =>
    ((tickUs - visibleStartUs) / visibleDurationUs) * 100;

  const major: TimeTick[] = [];
  const firstMajor =
    Math.ceil(visibleStartUs / majorIntervalUs) * majorIntervalUs;
  for (
    let tickUs = firstMajor;
    tickUs <= visibleEndUs;
    tickUs += majorIntervalUs
  ) {
    major.push({
      positionPercent: toPercent(tickUs),
      label: formatTickLabel(tickUs),
    });
  }

  const minor: Array<{ positionPercent: number }> = [];
  if (hasMinor) {
    const firstMinor =
      Math.ceil(visibleStartUs / minorIntervalUs) * minorIntervalUs;
    for (
      let tickUs = firstMinor;
      tickUs < visibleEndUs;
      tickUs += minorIntervalUs
    ) {
      if (tickUs % majorIntervalUs !== 0) {
        minor.push({ positionPercent: toPercent(tickUs) });
      }
    }
  }

  return { major, minor };
}

export function generateTimeTicks(durationUs: number): TimeRuler {
  return generateWindowTimeTicks(0, durationUs);
}
