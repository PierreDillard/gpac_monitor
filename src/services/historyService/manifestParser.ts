import type {
  HistoryManifest,
  HistoryManifestCheckpoint,
  HistoryManifestChunk,
  ManifestEventEntry,
} from './source/types';
import type { TimelineEventType } from './types';
import { parseJournalIndexPointer } from './journalIndexParser';

export function parseManifest(raw: unknown): HistoryManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[ManifestParser] manifest must be an object');
  }
  const data = raw as Record<string, unknown>;

  if (data['version'] !== 1) {
    throw new Error(`[ManifestParser] unsupported version: ${data['version']}`);
  }
  if (typeof data['startUs'] !== 'number') {
    throw new Error('[ManifestParser] startUs must be a number');
  }
  if (typeof data['endUs'] !== 'number') {
    throw new Error('[ManifestParser] endUs must be a number');
  }
  if (
    typeof data['chunkDurationUs'] !== 'number' ||
    data['chunkDurationUs'] <= 0
  ) {
    throw new Error(
      '[ManifestParser] chunkDurationUs must be a positive number',
    );
  }
  if (typeof data['chunkCount'] !== 'number' || data['chunkCount'] <= 0) {
    throw new Error('[ManifestParser] chunkCount must be a positive number');
  }

  let eventChunks: HistoryManifestChunk[] | undefined;
  if (Array.isArray(data['eventChunks'])) {
    const rawChunks = data['eventChunks'] as unknown[];
    const validChunks = rawChunks.filter(
      (chunk): chunk is HistoryManifestChunk => {
        if (!chunk || typeof chunk !== 'object') return false;
        const chk = chunk as Record<string, unknown>;
        return (
          typeof chk['file'] === 'string' &&
          typeof chk['fromUs'] === 'number' &&
          typeof chk['toUs'] === 'number' &&
          (chk['fromUs'] as number) <= (chk['toUs'] as number)
        );
      },
    );
    if (validChunks.length === rawChunks.length && validChunks.length > 0) {
      eventChunks = validChunks;
    }
  }

  const logChunks: HistoryManifestChunk[] = Array.isArray(data['logChunks'])
    ? (data['logChunks'] as unknown[]).filter(
        (chunk): chunk is HistoryManifestChunk => {
          if (!chunk || typeof chunk !== 'object') return false;
          const chk = chunk as Record<string, unknown>;
          return (
            typeof chk['file'] === 'string' &&
            typeof chk['fromUs'] === 'number' &&
            typeof chk['toUs'] === 'number' &&
            (chk['fromUs'] as number) < (chk['toUs'] as number)
          );
        },
      )
    : [];

  const checkpoints: HistoryManifestCheckpoint[] = Array.isArray(
    data['checkpoints'],
  )
    ? (data['checkpoints'] as unknown[]).filter(
        (cp): cp is HistoryManifestCheckpoint => {
          if (!cp || typeof cp !== 'object') return false;
          const chk = cp as Record<string, unknown>;
          return (
            typeof chk['chunkIndex'] === 'number' &&
            typeof chk['file'] === 'string'
          );
        },
      )
    : [];

  const VALID_EVENT_TYPES = new Set<TimelineEventType>([
    'graph-change',
    'pid-reconfig',
    'args-change',
    'error',
    'warning',
  ]);
  const eventsIndex: ManifestEventEntry[] = Array.isArray(data['eventsIndex'])
    ? (data['eventsIndex'] as unknown[]).filter(
        (entry): entry is ManifestEventEntry => {
          if (!entry || typeof entry !== 'object') return false;
          const rawEntry = entry as Record<string, unknown>;
          return (
            typeof rawEntry['ts_us'] === 'number' &&
            typeof rawEntry['type'] === 'string' &&
            VALID_EVENT_TYPES.has(rawEntry['type'] as TimelineEventType)
          );
        },
      )
    : [];

  return {
    version: 1,
    startUs: data['startUs'] as number,
    endUs: data['endUs'] as number,
    chunkDurationUs: data['chunkDurationUs'] as number,
    chunkCount: data['chunkCount'] as number,
    snapshot:
      typeof data['snapshot'] === 'string' ? data['snapshot'] : undefined,
    eventChunks,
    logChunks,
    checkpoints,
    eventsIndex,
    journalIndex: parseJournalIndexPointer(data),
  };
}

export function getDuration(manifest: HistoryManifest): number {
  return manifest.endUs - manifest.startUs;
}

function findChunkIndexForTimestamp(
  manifest: HistoryManifest,
  timestampUs: number,
): number {
  const eventChunks = manifest.eventChunks;

  if (!eventChunks || eventChunks.length === 0) {
    return 0;
  }

  let lowerBoundIndex = 0;
  let upperBoundIndex = eventChunks.length - 1;
  let matchingChunkIndex = 0;

  while (lowerBoundIndex <= upperBoundIndex) {
    const middleIndex = Math.floor(
      (lowerBoundIndex + upperBoundIndex) / 2,
    );

    const middleChunk = eventChunks[middleIndex];

    if (middleChunk.fromUs <= timestampUs) {
      matchingChunkIndex = middleIndex;
      lowerBoundIndex = middleIndex + 1;
    } else {
      upperBoundIndex = middleIndex - 1;
    }
  }

  return matchingChunkIndex;
}

/** Returns the chunk index for a given timestamp. */
export function findEventChunkIndex(
  manifest: HistoryManifest,
  timestampUs: number,
): number {
  if (manifest.eventChunks && manifest.eventChunks.length > 0) {
    return Math.min(
      findChunkIndexForTimestamp(manifest, timestampUs),
      manifest.chunkCount - 1,
    );
  }
  const arithmeticIndex = Math.floor(
    (timestampUs - manifest.startUs) / manifest.chunkDurationUs,
  );
  return Math.max(0, Math.min(arithmeticIndex, manifest.chunkCount - 1));
}

export function getChunkFile(index: number): string {
  return `chunks/chunk_${String(index).padStart(4, '0')}.jsonl`;
}

/** Returns the [fromUs, toUs] range for a given chunk index. */
export function getEventChunkRange(
  manifest: HistoryManifest,
  index: number,
): { fromUs: number; toUs: number } {
  const recordedChunk = manifest.eventChunks?.[index];
  if (recordedChunk) {
    return { fromUs: recordedChunk.fromUs, toUs: recordedChunk.toUs };
  }
  const fromUs = manifest.startUs + index * manifest.chunkDurationUs;
  const toUs = Math.min(fromUs + manifest.chunkDurationUs, manifest.endUs);
  return { fromUs, toUs };
}

/** Returns all logChunks whose [fromUs, toUs] intersects the given range. */
export function findLogChunksInRange(
  manifest: HistoryManifest,
  fromUs: number,
  toUs: number,
): HistoryManifestChunk[] {
  return (manifest.logChunks ?? []).filter(
    (chunk) => chunk.fromUs < toUs && chunk.toUs > fromUs,
  );
}

/** Returns the most recent checkpoint with chunkIndex <= position, or null. */
export function findNearestCheckpoint(
  manifest: HistoryManifest,
  position: number,
): HistoryManifestCheckpoint | null {
  let nearest: HistoryManifestCheckpoint | null = null;

  for (const checkpoint of manifest.checkpoints ?? []) {
    if (checkpoint.chunkIndex <= position) {
      if (nearest === null || checkpoint.chunkIndex > nearest.chunkIndex) {
        nearest = checkpoint;
      }
    }
  }

  return nearest;
}
