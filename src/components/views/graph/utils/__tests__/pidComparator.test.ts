import { describe, it, expect } from 'vitest';
import { arePidListsEqual } from '../pidComparator';
import { GpacStreamType } from '@/types/domain/gpac';

const makePid = (
  pid_index: number,
  name: string,
  stream_type = GpacStreamType.Visual,
) => ({
  pid_index,
  name,
  stream_type,
  source_idx: 0,
  ID: pid_index,
});

describe('arePidListsEqual', () => {
  it('returns true for two empty lists', () => {
    expect(arePidListsEqual([], [])).toBe(true);
  });

  it('returns true for identical lists', () => {
    const a = [makePid(0, 'video'), makePid(1, 'audio', GpacStreamType.Audio)];
    const b = [makePid(0, 'video'), makePid(1, 'audio', GpacStreamType.Audio)];
    expect(arePidListsEqual(a, b)).toBe(true);
  });

  it('returns false for different lengths', () => {
    const a = [makePid(0, 'video')];
    const b = [makePid(0, 'video'), makePid(1, 'audio')];
    expect(arePidListsEqual(a, b)).toBe(false);
  });

  it('returns false when name differs', () => {
    const a = [makePid(0, 'video_old')];
    const b = [makePid(0, 'video_new')];
    expect(arePidListsEqual(a, b)).toBe(false);
  });

  it('returns false when pid_index differs', () => {
    const a = [makePid(0, 'video')];
    const b = [makePid(1, 'video')];
    expect(arePidListsEqual(a, b)).toBe(false);
  });

  it('returns false when stream_type differs', () => {
    const a = [makePid(0, 'media', GpacStreamType.Visual)];
    const b = [makePid(0, 'media', GpacStreamType.Audio)];
    expect(arePidListsEqual(a, b)).toBe(false);
  });
});
