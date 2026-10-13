import type { JournalIndexPointer } from './source/types';
import type { JournalIndex } from './types';

/** Validates the small `journalIndex` pointer embedded in manifest.json. */
export function parseJournalIndexPointer(
  data: Record<string, unknown>,
): JournalIndexPointer | undefined {
  const raw = data['journalIndex'];
  if (!raw || typeof raw !== 'object') return undefined;
  const pointer = raw as Record<string, unknown>;
  if (
    typeof pointer['file'] !== 'string' ||
    typeof pointer['format'] !== 'string' ||
    typeof pointer['eventCount'] !== 'number' ||
    typeof pointer['errorCount'] !== 'number' ||
    typeof pointer['warningCount'] !== 'number'
  ) {
    return undefined;
  }
  return {
    file: pointer['file'],
    format: pointer['format'],
    eventCount: pointer['eventCount'],
    errorCount: pointer['errorCount'],
    warningCount: pointer['warningCount'],
  };
}

/** Parses journal_index.json's columnar content, decoded lazily by the caller. */
export function parseJournalIndex(raw: unknown): JournalIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const isNumberArray = (value: unknown): value is number[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'number');

  if (
    typeof data['baseTsUs'] !== 'number' ||
    !isNumberArray(data['tsDeltaUs']) ||
    !isNumberArray(data['types'])
  ) {
    return null;
  }

  return {
    baseTsUs: data['baseTsUs'],
    tsDeltaUs: data['tsDeltaUs'],
    types: data['types'],
  };
}

function parseJournalLine(line: string): { tsUs: number; type: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const entry = parsed as Record<string, unknown>;
  const tsUs = entry['ts_us'];
  const type = entry['type'];
  if (typeof tsUs !== 'number' || typeof type !== 'number') return null;
  return { tsUs, type };
}

export function parseJournalJsonl(text: string): JournalIndex | null {
  const tsUsList: number[] = [];
  const types: number[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = parseJournalLine(trimmed);
    if (!entry) continue;
    tsUsList.push(entry.tsUs);
    types.push(entry.type);
  }
  if (tsUsList.length === 0) return null;

  const baseTsUs = tsUsList[0];
  return {
    baseTsUs,
    tsDeltaUs: tsUsList.map((tsUs) => tsUs - baseTsUs),
    types,
  };
}
