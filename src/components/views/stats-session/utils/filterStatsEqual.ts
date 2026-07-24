import type { MonitoredFilterStats } from '@/types/domain/gpac/model';
import type { PIDproperties, PIDStats } from '@/types/domain/gpac/filter-stats';

const lastTsSentEqual = (
  prev: PIDStats['last_ts_sent'],
  next: PIDStats['last_ts_sent'],
): boolean => {
  if (prev === next) return true;
  if (prev == null || next == null) return false;
  if (typeof prev === 'number' || typeof next === 'number') {
    return prev === next;
  }
  const prevNum = 'num' in prev ? prev.num : prev.n;
  const prevDen = 'num' in prev ? prev.den : prev.d;
  const nextNum = 'num' in next ? next.num : next.n;
  const nextDen = 'num' in next ? next.den : next.d;
  return prevNum === nextNum && prevDen === nextDen;
};

const pidStatsEqual = (
  prev: PIDStats | undefined,
  next: PIDStats | undefined,
): boolean => {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return (
    prev.disconnected === next.disconnected &&
    prev.average_bitrate === next.average_bitrate &&
    prev.max_bitrate === next.max_bitrate &&
    prev.average_process_rate === next.average_process_rate &&
    prev.max_process_rate === next.max_process_rate &&
    prev.nb_processed === next.nb_processed &&
    (prev.average_process_time ?? null) ===
      (next.average_process_time ?? null) &&
    prev.max_process_time === next.max_process_time &&
    prev.total_process_time === next.total_process_time &&
    lastTsSentEqual(prev.last_ts_sent, next.last_ts_sent) &&
    (prev.first_process_time ?? null) === (next.first_process_time ?? null) &&
    (prev.last_process_time ?? null) === (next.last_process_time ?? null) &&
    (prev.buffer_time ?? null) === (next.buffer_time ?? null) &&
    (prev.nb_buffer_units ?? null) === (next.nb_buffer_units ?? null) &&
    (prev.max_buffer_time ?? null) === (next.max_buffer_time ?? null) &&
    (prev.max_playout_time ?? null) === (next.max_playout_time ?? null) &&
    (prev.min_playout_time ?? null) === (next.min_playout_time ?? null)
  );
};

export const pidPropertiesEqual = (
  prev: PIDproperties,
  next: PIDproperties,
): boolean =>
  prev.buffer === next.buffer &&
  (prev.max_buffer ?? null) === (next.max_buffer ?? null) &&
  prev.bitrate === next.bitrate &&
  prev.codec === next.codec &&
  prev.type === next.type &&
  prev.width === next.width &&
  prev.height === next.height &&
  prev.pixelformat === next.pixelformat &&
  prev.samplerate === next.samplerate &&
  prev.channels === next.channels &&
  (prev.language ?? null) === (next.language ?? null) &&
  pidStatsEqual(prev.stats, next.stats);

const pidMapEqual = (
  prev: Record<string, PIDproperties> | undefined,
  next: Record<string, PIDproperties> | undefined,
): boolean => {
  const prevKeys = Object.keys(prev ?? {});
  const nextKeys = Object.keys(next ?? {});
  if (prevKeys.length !== nextKeys.length) return false;

  return prevKeys.every((key) => {
    const prevPid = prev?.[key];
    const nextPid = next?.[key];
    return !!prevPid && !!nextPid && pidPropertiesEqual(prevPid, nextPid);
  });
};

/**
 * True when two filter stats snapshots carry the same UI-visible values
 * (Overview + PID tables). Used to skip a setState when GPAC re-sends
 * an identical payload for a monitored filter.
 */
export const filterStatsEqual = (
  prev: MonitoredFilterStats | null,
  next: MonitoredFilterStats | null,
): boolean => {
  if (prev === next) return true;
  if (!prev || !next) return false;

  return (
    prev.idx === next.idx &&
    prev.status === next.status &&
    prev.bytes_done === next.bytes_done &&
    prev.bytes_sent === next.bytes_sent &&
    prev.pck_sent === next.pck_sent &&
    prev.pck_done === next.pck_done &&
    prev.time === next.time &&
    (prev.last_task_time ?? null) === (next.last_task_time ?? null) &&
    prev.nb_ipid === next.nb_ipid &&
    prev.nb_opid === next.nb_opid &&
    pidMapEqual(prev.ipids, next.ipids) &&
    pidMapEqual(prev.opids, next.opids)
  );
};
