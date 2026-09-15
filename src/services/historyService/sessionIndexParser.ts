import type {
  HistorySessionIndex,
  HistorySessionIndexSegment,
  ManifestEventEntry,
} from './source/types';

function parseSegment(raw: unknown): HistorySessionIndexSegment | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data['index'] !== 'number') return null;
  return {
    index: data['index'],
    fromUs: typeof data['fromUs'] === 'number' ? data['fromUs'] : null,
    toUs: typeof data['toUs'] === 'number' ? data['toUs'] : undefined,
  };
}

export function parseSessionIndex(raw: unknown): HistorySessionIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  if (data['version'] !== 1) {
    throw new Error(
      `[SessionIndexParser] unsupported version: ${data['version']}`,
    );
  }

  const segments = Array.isArray(data['segments'])
    ? data['segments']
        .map(parseSegment)
        .filter(
          (segment): segment is HistorySessionIndexSegment => segment !== null,
        )
    : [];

  return {
    version: 1,
    startUs: typeof data['startUs'] === 'number' ? data['startUs'] : null,
    endUs: typeof data['endUs'] === 'number' ? data['endUs'] : undefined,
    segmentDurationUs: Number(data['segmentDurationUs']) || 0,
    retentionMaxSegments: Number(data['retentionMaxSegments']) || 0,
    segments,
  };
}

export function parseEventsIndex(raw: unknown): ManifestEventEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is ManifestEventEntry => {
    if (!entry || typeof entry !== 'object') return false;
    const data = entry as Record<string, unknown>;
    return (
      typeof data['ts_us'] === 'number' && typeof data['type'] === 'string'
    );
  });
}

export function getSegmentDir(segment: HistorySessionIndexSegment): string {
  return `segments/${String(segment.index).padStart(4, '0')}`;
}

export function getSegmentToUs(
  sessionIndex: HistorySessionIndex,
  segmentPosition: number,
): number | undefined {
  const segment = sessionIndex.segments[segmentPosition];
  if (!segment) return undefined;
  if (segment.toUs !== undefined) return segment.toUs;

  const nextSegment = sessionIndex.segments[segmentPosition + 1];
  if (nextSegment && nextSegment.fromUs !== null) return nextSegment.fromUs;

  return sessionIndex.endUs;
}

export function findSegmentForTimestamp(
  sessionIndex: HistorySessionIndex,
  tsUs: number,
): HistorySessionIndexSegment | null {
  let candidate: HistorySessionIndexSegment | null = null;
  let candidateFromUs = 0;

  for (const segment of sessionIndex.segments) {
    // Skip segments that haven't started yet, or start after tsUs.
    if (segment.fromUs === null || segment.fromUs > tsUs) continue;
    // Then keep the one starting closest to tsUs
    if (candidate === null || segment.fromUs > candidateFromUs) {
      candidate = segment;
      candidateFromUs = segment.fromUs;
    }
  }

  // tsUs before the first known fromUs: fall back to the first segment.
  return candidate ?? sessionIndex.segments[0] ?? null;
}

export function findPreviousSegmentDir(
  sessionIndex: HistorySessionIndex,
  currentSegmentDir: string,
): string | undefined {
  const currentPosition = sessionIndex.segments.findIndex(
    (segment) => getSegmentDir(segment) === currentSegmentDir,
  );
  if (currentPosition <= 0) return undefined;
  return getSegmentDir(sessionIndex.segments[currentPosition - 1]);
}

export function hasNextSegment(
  sessionIndex: HistorySessionIndex,
  segmentDir: string,
): boolean {
  const currentPosition = sessionIndex.segments.findIndex(
    (segment) => getSegmentDir(segment) === segmentDir,
  );
  return (
    currentPosition >= 0 && currentPosition < sessionIndex.segments.length - 1
  );
}

export function isSegmentDone(
  sessionIndex: HistorySessionIndex,
  segmentPosition: number,
): boolean {
  if (segmentPosition < sessionIndex.segments.length - 1) return true;
  return sessionIndex.endUs !== undefined;
}
