import type { HistorySnapshot } from '../types';
import type {
  HistoryManifest,
  HistorySessionIndex,
  HistorySource,
} from '../source/types';
import { ChunkLoader } from '../chunkLoader';
import { ChunkPreloadController } from './chunkPreloadController';
import type {
  AppendLogsCallback,
  PlayerInterface,
} from './chunkPreloadController';
import { SegmentSwitchController } from './segmentSwitchController';
import { findSegmentForTimestamp, hasNextSegment } from '../sessionIndexParser';

export type SegmentSwitchOutcome =
  | { stale: true }
  | { stale: false; changed: false; failed?: true }
  | {
      stale: false;
      changed: true;
      manifest: HistoryManifest;
      loader: ChunkLoader;
      preloader: ChunkPreloadController;
      snapshot: HistorySnapshot;
      segmentDir: string;
    };

export async function resolveSegmentSwitch(params: {
  sessionIndex: HistorySessionIndex | null;
  source: HistorySource;
  tsUs: number;
  segmentDir: string | undefined;
  preloader: ChunkPreloadController;
  player: PlayerInterface;
  appendLogs: AppendLogsCallback;
}): Promise<SegmentSwitchOutcome> {
  const {
    sessionIndex,
    source,
    tsUs,
    segmentDir,
    preloader,
    player,
    appendLogs,
  } = params;

  if (!sessionIndex) return { stale: false, changed: false };
  const targetSegment = findSegmentForTimestamp(sessionIndex, tsUs);
  if (!targetSegment) return { stale: false, changed: false };

  const version = preloader.getVersion();
  const segmentSwitch = new SegmentSwitchController(source, () =>
    preloader.getVersion(),
  );
  const switched = await segmentSwitch.switchTo(targetSegment, segmentDir);
  if (version !== preloader.getVersion()) return { stale: true };
  if (switched.stale) return { stale: true };
  if (!switched.changed) return switched;

  const loader = new ChunkLoader(
    source,
    switched.manifest,
    switched.segmentDir,
  );
  const newPreloader = new ChunkPreloadController(
    loader,
    switched.manifest,
    player,
    appendLogs,
    hasNextSegment(sessionIndex, switched.segmentDir),
  );

  return {
    stale: false,
    changed: true,
    manifest: switched.manifest,
    loader,
    preloader: newPreloader,
    snapshot: switched.snapshot,
    segmentDir: switched.segmentDir,
  };
}
