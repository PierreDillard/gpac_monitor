import { describe, it, expect } from 'vitest';
import { createEdgesFromFilters } from '../GraphOperations';
import { GraphFilterData } from '@/types/domain/gpac';

function makeFilter(
  idx: number,
  name: string,
  ipid: GraphFilterData['ipid'],
  opid: GraphFilterData['opid'],
): GraphFilterData {
  return {
    idx,
    name,
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

// gpac -i input.mp4 -i input.mp4 reframer:rt=on c=avc -o dash/test.mpd
// GPAC dedups the reframer by its options: a single instance (idx 3) fed by both
// demuxers, so 4 ipid / 4 opid where both video opids carry ID=1 and both audio
// opids carry ID=2. Only source_opid_idx tells them apart.
function duplicateInputSession(): GraphFilterData[] {
  const videoOpid = {
    pid_index: 0,
    name: 'video',
    stream_type: 'Visual' as const,
    ID: 1,
  };
  const audioOpid = {
    pid_index: 1,
    name: 'audio',
    stream_type: 'Audio' as const,
    ID: 2,
  };

  return [
    makeFilter(6, 'mp4dmx', [], [videoOpid, audioOpid]),
    makeFilter(7, 'mp4dmx', [], [videoOpid, audioOpid]),
    makeFilter(
      3,
      'reframer',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 6,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
        {
          pid_index: 1,
          name: 'audio',
          source_idx: 6,
          source_opid_idx: 1,
          stream_type: 'Audio',
          ID: 2,
        },
        {
          pid_index: 2,
          name: 'video',
          source_idx: 7,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
        {
          pid_index: 3,
          name: 'audio',
          source_idx: 7,
          source_opid_idx: 1,
          stream_type: 'Audio',
          ID: 2,
        },
      ],
      [
        { pid_index: 0, name: 'video', stream_type: 'Visual', ID: 1 },
        { pid_index: 1, name: 'audio', stream_type: 'Audio', ID: 2 },
        { pid_index: 2, name: 'video', stream_type: 'Visual', ID: 1 },
        { pid_index: 3, name: 'audio', stream_type: 'Audio', ID: 2 },
      ],
    ),
    makeFilter(
      4,
      'ffenc',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 3,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [videoOpid],
    ),
    makeFilter(
      5,
      'ffenc',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 3,
          source_opid_idx: 2,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [videoOpid],
    ),
    makeFilter(
      8,
      'dasher',
      [
        {
          pid_index: 0,
          name: 'audio',
          source_idx: 3,
          source_opid_idx: 1,
          stream_type: 'Audio',
          ID: 2,
        },
        {
          pid_index: 1,
          name: 'audio',
          source_idx: 3,
          source_opid_idx: 3,
          stream_type: 'Audio',
          ID: 2,
        },
        {
          pid_index: 2,
          name: 'video',
          source_idx: 4,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
        {
          pid_index: 3,
          name: 'video',
          source_idx: 5,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [],
    ),
  ];
}

describe('createEdgesFromFilters with source_opid_idx', () => {
  it('anchors the 4 edges of a reframer fed twice on their 4 exact opids, though both video opids share ID=1 and both audio opids share ID=2', () => {
    const edges = createEdgesFromFilters(duplicateInputSession(), []);
    const fromReframer = edges.filter((edge) => edge.source === '3');

    expect(fromReframer).toHaveLength(4);
    expect(new Set(fromReframer.map((edge) => edge.sourceHandle)).size).toBe(4);

    expect(
      edges.find((edge) => edge.id === 'edge:3->4:ipid:0')?.sourceHandle,
    ).toBe('opid-0');
    expect(
      edges.find((edge) => edge.id === 'edge:3->5:ipid:0')?.sourceHandle,
    ).toBe('opid-2');
    expect(
      edges.find((edge) => edge.id === 'edge:3->8:ipid:0')?.sourceHandle,
    ).toBe('opid-1');
    expect(
      edges.find((edge) => edge.id === 'edge:3->8:ipid:1')?.sourceHandle,
    ).toBe('opid-3');
  });

  it('anchors on the exact index even when several opids of the source share the same ID', () => {
    const src = makeFilter(
      0,
      'src',
      [],
      [
        { pid_index: 0, name: 'video', stream_type: 'Visual', ID: 1 },
        { pid_index: 1, name: 'video', stream_type: 'Visual', ID: 1 },
      ],
    );
    const sink = makeFilter(
      1,
      'sink',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 0,
          source_opid_idx: 1,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([src, sink], []);
    expect(edges[0].sourceHandle).toBe('opid-1');
  });

  it('leaves the edge unanchored when GPAC reports an index beyond the opids of the source', () => {
    const src = makeFilter(
      0,
      'src',
      [],
      [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 1 }],
    );
    const sink = makeFilter(
      1,
      'sink',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 0,
          source_opid_idx: 4,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([src, sink], []);
    expect(edges[0].sourceHandle).toBeUndefined();
  });

  it('keeps a real fan-out on the same handle when several sinks read the same opid', () => {
    const dmx = makeFilter(
      0,
      'mp4dmx',
      [],
      [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 1 }],
    );
    const encoder = makeFilter(
      1,
      'ffenc',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 0,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [],
    );
    const dasher = makeFilter(
      2,
      'dasher',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 0,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 1,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([dmx, encoder, dasher], []);

    expect(edges).toHaveLength(2);
    expect(edges.every((edge) => edge.sourceHandle === 'opid-0')).toBe(true);
  });

  it.each([
    ['absent (snapshot recorded before the field existed)', undefined],
    ['-1 (GPAC older than the ipid_source_opid_idx binding)', -1],
  ])(
    'anchors nothing rather than guessing a handle when source_opid_idx is %s',
    (_label, sourceOpidIdx) => {
      const src = makeFilter(
        3,
        'src',
        [],
        [
          { pid_index: 0, name: 'audio', stream_type: 'Audio', ID: 400 },
          { pid_index: 1, name: 'audio', stream_type: 'Audio', ID: 401 },
        ],
      );
      const sink = makeFilter(
        5,
        'sink',
        [
          {
            pid_index: 0,
            name: 'audio',
            source_idx: 3,
            source_opid_idx: sourceOpidIdx,
            stream_type: 'Audio',
            ID: 400,
          },
          {
            pid_index: 1,
            name: 'audio',
            source_idx: 3,
            source_opid_idx: sourceOpidIdx,
            stream_type: 'Audio',
            ID: 401,
          },
        ],
        [],
      );

      const edges = createEdgesFromFilters([src, sink], []);

      expect(edges).toHaveLength(2);
      expect(edges.every((edge) => edge.sourceHandle === undefined)).toBe(true);
    },
  );
});
