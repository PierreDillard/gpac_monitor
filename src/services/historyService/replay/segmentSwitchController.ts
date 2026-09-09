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

export class SegmentSwitchController {
  constructor(
    private readonly source: HistorySource,
    private readonly getVersion: () => number,
  ) {}

  async switchTo(
    targetSegment: HistorySessionIndexSegment,
    currentSegmentDir: string | undefined,
  ): Promise<SegmentSwitchResult | null> {
    const targetSegmentDir = getSegmentDir(targetSegment);
    if (targetSegmentDir === currentSegmentDir) return null;

    const version = this.getVersion();
    const manifest = await this.source.getSegmentManifest(targetSegmentDir);
    if (version !== this.getVersion() || !manifest) return null;

    const snapshot = await this.source.loadSegmentSnapshot(targetSegmentDir);
    if (version !== this.getVersion()) return null;

    return { manifest, snapshot, segmentDir: targetSegmentDir };
  }
}
