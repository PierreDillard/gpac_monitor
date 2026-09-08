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

export function isSegmentDone(
  sessionIndex: HistorySessionIndex,
  segmentPosition: number,
): boolean {
  if (segmentPosition < sessionIndex.segments.length - 1) return true;
  return sessionIndex.endUs !== undefined;
}
