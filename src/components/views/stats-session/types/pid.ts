import type { FilterStatsResponse, TabPIDData } from '@/types';
import type { GpacStreamType } from '@/types/domain/gpac';

export type PIDMetricMode =
  // Buffer group
  | 'bufferTime'
  | 'buffer'
  // Bitrate group
  | 'bitrate'
  // Process time group
  | 'processTime'
  // Process rate group
  | 'processRate'
  // Last proc group
  | 'ts'
  | 'lastTsSent';

export interface PIDMetricSample {
  sessionTimeUs: number;
  // Buffer column
  bufferTime?: number | null;
  buffer?: number | null;
  // Bitrate column
  averageBitrate?: number | null;
  // Process time column
  processTime?: number | null;
  // Process rate column
  processRate?: number | null;
  // Last proc column
  ts?: number | null;
  lastTsSent?: number | null;
}

export interface PIDGraphTarget {
  filterIdx: number;
  direction: 'input' | 'output';
  pidIndex: number;
  label?: string;
  infoLine?: string;
  streamTypeLabel?: string;
  streamType?: GpacStreamType;
}

export const buildPIDKey = (
  filterIdx: number,
  direction: 'input' | 'output',
  pidIndex: number,
): string => `${filterIdx}:${direction}:${pidIndex}`;

/**
 * PID data with position index for edge mapping
 * pidIdx is the 0-based position index in the parent filter's pid list
 */
export interface PIDWithIndex extends TabPIDData {
  pidIdx: number;
}

/**
 * Props for InputsTab component
 */
export interface InputsTabProps {
  filterData: FilterStatsResponse;
  filterName: string;
  isLoading?: boolean;
}

/**
 * Props for InputCard component
 */
export interface InputCardProps {
  inputName: string;
  pidsByType: Record<string, PIDWithIndex[]>;
  filterIdx: number;
}
