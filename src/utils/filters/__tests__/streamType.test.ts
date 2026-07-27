import { describe, it, expect } from 'vitest';
import { getFilterInfoByIdx } from '../streamType';
import type { GraphFilterData } from '@/types/domain/gpac';

function makeFilter(
  idx: number,
  ipid: GraphFilterData['ipid'],
  opid: GraphFilterData['opid'],
): GraphFilterData {
  return {
    idx,
    name: `filter-${idx}`,
    type: 'filter',
    status: '',
    itag: null,
    ID: null,
    nb_ipid: ipid.length,
    nb_opid: opid.length,
    ipid,
    opid,
  };
}

describe('getFilterInfoByIdx', () => {
  it('returns file type when filter not found', () => {
    const result = getFilterInfoByIdx([], 99);
    expect(result.streamType).toBe('file');
  });

  it('derives video from opid stream_type Visual', () => {
    const filters = [
      makeFilter(0, [], [{ pid_index: 0, name: 'vid', stream_type: 'Visual', ID: 1 }]),
    ];
    expect(getFilterInfoByIdx(filters, 0).streamType).toBe('video');
  });

  it('derives audio from opid stream_type Audio', () => {
    const filters = [
      makeFilter(0, [], [{ pid_index: 0, name: 'aud', stream_type: 'Audio', ID: 1 }]),
    ];
    expect(getFilterInfoByIdx(filters, 0).streamType).toBe('audio');
  });

  it('falls back to ipid when opid is empty', () => {
    const filters = [
      makeFilter(
        0,
        [{ pid_index: 0, name: 'aud', source_idx: 1, stream_type: 'Audio', ID: 1 }],
        [],
      ),
    ];
    expect(getFilterInfoByIdx(filters, 0).streamType).toBe('audio');
  });

  it('returns file when no PID has a recognized stream_type', () => {
    const filters = [
      makeFilter(0, [], [{ pid_index: 0, name: 'x', stream_type: 'File', ID: 1 }]),
    ];
    expect(getFilterInfoByIdx(filters, 0).streamType).toBe('file');
  });
});
