import { Node, Edge, EdgeProps } from '@xyflow/react';
import type { GpacArgument } from './gpac_args';
import type { PIDproperties } from './filter-stats';
import { GpacStreamType } from './stream-types';

// MONITORING
export interface MonitoredFilterStats {
  idx: number;
  status: string;
  bytes_done: number;
  bytes_sent: number;
  pck_sent: number;
  pck_done: number;
  time: number;
  last_task_time?: number;
  nb_ipid: number;
  nb_opid: number;
  ipids?: Record<string, PIDproperties>;
  opids?: Record<string, PIDproperties>;
}
export interface EnrichedFilterOverview extends Record<string, unknown> {
  // STATIC GRAPH DATA
  name: string;
  type: string;
  idx: number;
  ID: string | null;
  itag: string | null;
  nb_ipid: number;
  nb_opid: number;
  tasks?: number;
  errors?: number;
  current_errors?: number;
  ipid: Record<string, PIDData>;
  opid: Record<string, PIDData>;
  gpac_args?: GpacArgument[];
  class?: string;
  codec?: string;
  streamtype?: string;
  last_ts_sent?: TimeFraction;

  // Parsed version of status (set by enrichedStatsWorker)
  parsedStatus?: import('@/utils/metrics/filterStatusParser').ParsedFilterStatus;

  // Dynamic session data (updated from SessionFilterStatistics)
  status: string;
  bytes_done: number;
  bytes_sent: number;
  pck_done: number;
  pck_sent: number;
  time: number;
  is_eos?: boolean;

  // Computed metrics (added by enrichedStatsWorker)
  computed?: {
    bufferUsage: number;
    activityLevel: string;
    activityColor: string;
    activityLabel: string;
    sessionType: string;
    formattedBytes: string;
    formattedTime: string;
    formattedPackets: string;
  };
}

export interface GpacNodeData extends EnrichedFilterOverview {}

export type GpacNode = Node<GpacNodeData>;

export interface PIDPropertyValue {
  type: string;
  val: number | string | TimeFraction;
}

export interface PIDData {
  // Direct properties from server
  buffer: number;
  buffer_total: number;
  source_idx?: number;

  // Properties stored as objects with type/val structure
  [key: string]: PIDPropertyValue | number | string | undefined;

  // Common decoded properties for convenience
  codec?: string;
  width?: number;
  height?: number;
  FPS?: string;
  samplerate?: number;
  channels?: number;
  format?: string;
}
export interface TimeFraction {
  num: number;
  den: number;
}

// GRAPH

export interface GraphInputPid {
  pid_index: number;
  name: string;
  source_idx: number;
  stream_type: GpacStreamType;
  ID: number;
}

export interface GraphOutputPid {
  pid_index: number;
  name: string;
  stream_type: GpacStreamType;
  ID: number;
}

export interface GraphFilterData {
  idx: number;
  name: string;
  type: string;
  status: string;
  itag: string | null;
  ID: string | null;
  nb_ipid: number;
  nb_opid: number;
  ipid: GraphInputPid[];
  opid: GraphOutputPid[];
}
export type FilterType = 'video' | 'audio' | 'text' | 'file';

export interface EdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  filterType: FilterType;
  bufferPercentage: number;
  pidName: string;
  sourceFilterIdx: number;
  targetFilterIdx: number;
}

export type GpacEdge = Edge<EdgeData>;

export interface GpacEdgeProps extends EdgeProps<EdgeData> {
  data: EdgeData;
}
