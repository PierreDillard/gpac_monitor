/**
 * Time formatting utilities
 */

/** Formats a session id (`YYYY-MM-DD_HH-MM-SS`) for display, e.g. "2026-07-21 14:32:05". */
export const formatSessionId = (sessionId: string): string => {
  const [datePart, timePart] = sessionId.split('_');
  if (!datePart || !timePart) return sessionId;
  return `${datePart} ${timePart.replace(/-/g, ':')}`;
};

type TsFraction = { n: number; d: number } | { num: number; den: number };

/** Formats a µs duration to a human-readable string. Returns '—' for invalid values. */
export const formatMicroseconds = (
  value: number | null | undefined,
): string => {
  if (value == null || isNaN(value) || value < 0) return '—';
  if (value < 1000) return `${Math.round(value)}µs`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}ms`;
  return `${(value / 1_000_000).toFixed(2)}s`;
};

export const tsFractionToSeconds = (
  ts: TsFraction | number | null | undefined,
): number | null => {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts > 0 ? ts : null;
  const num = 'n' in ts ? ts.n : ts.num;
  const den = 'n' in ts ? ts.d : ts.den;
  return den ? num / den : null;
};

/** Formats a GPAC last_ts_sent value ({n,d}, {num,den} or raw seconds). */
export const formatLastTsSent = (
  ts: TsFraction | number | null | undefined,
): string => {
  const seconds = tsFractionToSeconds(ts);
  return seconds != null ? `${seconds.toFixed(2)}s` : '—';
};

export const formatTime = (microseconds?: number): string => {
  if (microseconds === undefined) return '0 ms';
  if (microseconds < 1000) return `${microseconds.toFixed(0)} μs`;

  const milliseconds = microseconds / 1000;
  if (milliseconds < 1000) return `${milliseconds.toFixed(2)} ms`;

  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds.toFixed(0)}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds.toFixed(0)}s`;
};

export const microsecondsToSeconds = (microseconds: number): number => {
  return microseconds / 1_000_000;
};

export const formatMMSS = (microseconds: number): string => {
  const totalSeconds = Math.floor(microseconds / 1_000_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const parseMMSS = (str: string, maxUs: number): number | null => {
  const match = str.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const us = (parseInt(match[1], 10) * 60 + parseInt(match[2], 10)) * 1_000_000;
  return us >= 0 && us <= maxUs ? us : null;
};

/** Formats a GPAC status time fraction (num/den) as a human-readable duration. */
export const formatFractionAsTime = (num: number, den: number): string => {
  if (den === 0) return '—';
  const seconds = num / den;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  if (mins < 60) return `${mins}:${secs}`;
  const hours = Math.floor(mins / 60);
  const remainingMins = (mins % 60).toString().padStart(2, '0');
  return `${hours}:${remainingMins}:${secs}`;
};

/** Formats a GPAC time fraction as readable duration plus the raw fraction, e.g. "21.32s (1918917/90000)". */
export const formatFractionAsTimeWithRaw = (
  num: number,
  den: number,
): string => {
  if (den === 0) return '—';
  return `${formatFractionAsTime(num, den)} (${num}/${den})`;
};

/**
 * Formats current time as HH:MM:SS for chart display
 */
export const formatChartTime = (): string => {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatChartTimeFromUs = (microseconds: number): string => {
  const totalSeconds = Math.floor(microseconds / 1_000_000);
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export const formatCompactTime = (us: number, withCs = false): string => {
  const totalSeconds = Math.floor(us / 1_000_000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const ss = String(seconds).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const cs = withCs
    ? `.${String(Math.floor((us % 1_000_000) / 10_000)).padStart(2, '0')}`
    : '';
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${mm}:${ss}${cs}`;
  return `${mm}:${ss}${cs}`;
};

export const formatBufferTime = (microseconds: number): string => {
  if (microseconds === 0) return '0 ms';
  const milliseconds = microseconds / 1000;
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${Math.floor(milliseconds)} ms`;
};

/**
 * Format seconds for chart X-axis display
 * 0-60s -> "Xs", 60-3600s -> "Xm Ys", >3600s -> "Xh Ym"
 */
export const formatChartSeconds = (seconds: number): string => {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};
