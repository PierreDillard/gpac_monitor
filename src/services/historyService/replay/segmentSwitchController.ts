import type { HistorySnapshot } from '../types';
import type {
  HistoryManifest,
  HistorySessionIndexSegment,
  HistorySource,
} from '../source/types';
import { getSegmentDir } from '../sessionIndexParser';

export type SegmentSwitchResult = {
  manifest: HistoryManifest;
  snapshot: HistorySnapshot;
  segmentDir: string;
};

export type SegmentSwitchAttempt =
  | { stale: true }
  | { stale: false; changed: false; failed?: true }
  | ({ stale: false; changed: true } & SegmentSwitchResult);

export class SegmentSwitchController {
  constructor(
    private readonly source: HistorySource,
    private readonly getVersion: () => number,
  ) {}

  async switchTo(
    targetSegment: HistorySessionIndexSegment,
    currentSegmentDir: string | undefined,
  ): Promise<SegmentSwitchAttempt> {
    const targetSegmentDir = getSegmentDir(targetSegment);
    if (targetSegmentDir === currentSegmentDir) {
      return { stale: false, changed: false };
    }

    const version = this.getVersion();
    const manifest = await this.source.getSegmentManifest(targetSegmentDir);
    if (version !== this.getVersion()) return { stale: true };
    if (!manifest) return { stale: false, changed: false, failed: true };

    const snapshot = await this.source.loadSegmentSnapshot(targetSegmentDir);
    if (version !== this.getVersion()) return { stale: true };

    return {
      stale: false,
      changed: true,
      manifest,
      snapshot,
      segmentDir: targetSegmentDir,
    };
  }
}
