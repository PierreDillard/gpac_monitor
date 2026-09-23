import { useMemo } from 'react';
import type { PIDproperties } from '@/types/domain/gpac/filter-stats';
import { GpacStreamType } from '@/types/domain/gpac/stream-types';
import { formatGpacFps } from '../pid/utils/pidProps';
import { formatSamplerate } from '@/utils/formatting';

export interface PIDInfoStats {
  codec: string | null;
  type: GpacStreamType;
  width: number | null;
  height: number | null;
  pixelformat: string | null;
  fps: string;
  samplerate: number | null;
  channels: number | null;
  language: string | null;
  infoLine: string;
}

const buildInfoLine = (stats: Omit<PIDInfoStats, 'infoLine'>): string => {
  const parts: string[] = [];

  if (stats.codec) parts.push(stats.codec.toLowerCase());

  if (stats.type === GpacStreamType.Visual) {
    if (stats.width && stats.height)
      parts.push(`${stats.width}×${stats.height}`);
    if (stats.fps !== '—') parts.push(stats.fps);
  } else if (stats.type === GpacStreamType.Audio) {
    if (stats.samplerate != null)
      parts.push(formatSamplerate(stats.samplerate));
    if (stats.channels) parts.push(`${stats.channels} ch`);
  } else if (stats.type === GpacStreamType.Text && stats.language) {
    parts.push(stats.language);
  }

  return parts.join(' · ') || '—';
};

export const usePIDInfoStats = (pid: PIDproperties): PIDInfoStats => {
  return useMemo(() => {
    const fps = formatGpacFps(pid.properties?.['FPS']?.value);

    const base = {
      codec: pid.codec || null,
      type: pid.type,
      width: pid.width,
      height: pid.height,
      pixelformat: pid.pixelformat,
      fps,
      samplerate: pid.samplerate,
      channels: pid.channels,
      language: pid.language ?? null,
    };

    return { ...base, infoLine: buildInfoLine(base) };
  }, [
    pid.codec,
    pid.type,
    pid.width,
    pid.height,
    pid.pixelformat,
    pid.properties,
    pid.samplerate,
    pid.channels,
    pid.language,
  ]);
};
