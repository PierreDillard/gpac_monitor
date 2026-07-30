import { describe, it, expect } from 'vitest';
import {
  createEdgesFromFilters,
  createNodesFromFilters,
} from '../GraphOperations';
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

describe('createEdgesFromFilters', () => {
  it('creates one edge for a single-source connection', () => {
    const src = makeFilter(
      0,
      'mp4dmx',
      [],
      [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 100 }],
    );
    const reframer = makeFilter(
      1,
      'reframer',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 0,
          source_opid_idx: 0,
          stream_type: 'Visual',
          ID: 100,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([src, reframer], []);
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('edge:0->1:ipid:0');
    expect(edges[0].source).toBe('0');
    expect(edges[0].target).toBe('1');
    expect(edges[0].targetHandle).toBe('ipid-0');
    expect(edges[0].sourceHandle).toBe('opid-0');
  });

  it('creates two edges when two sources have input PIDs with the same name (regression: gpac -i video.mp4 -i video.mp4 reframer)', () => {
    const src1 = makeFilter(
      0,
      'mp4dmx#1',
      [],
      [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 200 }],
    );
    const src2 = makeFilter(
      1,
      'mp4dmx#2',
      [],
      [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 201 }],
    );
    const reframer = makeFilter(
      2,
      'reframer',
      [
        {
          pid_index: 0,
          name: 'video',
          source_idx: 0,
          stream_type: 'Visual',
          ID: 200,
        },
        {
          pid_index: 1,
          name: 'video',
          source_idx: 1,
          stream_type: 'Visual',
          ID: 201,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([src1, src2, reframer], []);

    expect(edges).toHaveLength(2);

    const edge1 = edges.find((e) => e.id === 'edge:0->2:ipid:0');
    const edge2 = edges.find((e) => e.id === 'edge:1->2:ipid:1');

    expect(edge1).toBeDefined();
    expect(edge1?.source).toBe('0');
    expect(edge1?.target).toBe('2');
    expect(edge1?.targetHandle).toBe('ipid-0');

    expect(edge2).toBeDefined();
    expect(edge2?.source).toBe('1');
    expect(edge2?.target).toBe('2');
    expect(edge2?.targetHandle).toBe('ipid-1');
  });

  it('creates no edges for source filters with no input PIDs', () => {
    const src = makeFilter(
      0,
      'mp4dmx',
      [],
      [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 300 }],
    );
    const edges = createEdgesFromFilters([src], []);
    expect(edges).toHaveLength(0);
  });

  it('uses stable edge IDs regardless of PID display name', () => {
    const src = makeFilter(
      3,
      'src',
      [],
      [
        { pid_index: 0, name: 'audio_track_1', stream_type: 'Audio', ID: 400 },
        { pid_index: 1, name: 'audio_track_1', stream_type: 'Audio', ID: 401 },
      ],
    );
    const sink = makeFilter(
      5,
      'sink',
      [
        {
          pid_index: 0,
          name: 'audio_track_1',
          source_idx: 3,
          stream_type: 'Audio',
          ID: 400,
        },
        {
          pid_index: 1,
          name: 'audio_track_1',
          source_idx: 3,
          stream_type: 'Audio',
          ID: 401,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([src, sink], []);
    expect(edges).toHaveLength(2);
    expect(edges[0].id).toBe('edge:3->5:ipid:0');
    expect(edges[1].id).toBe('edge:3->5:ipid:1');
  });

  it('picks the sourceHandle matching the exact source opid, not just the first PID of the same stream_type and same display name (regression: two same-named opids must not collapse onto the same handle)', () => {
    const src = makeFilter(
      3,
      'src',
      [],
      [
        { pid_index: 0, name: 'audio_track_1', stream_type: 'Audio', ID: 400 },
        { pid_index: 1, name: 'audio_track_1', stream_type: 'Audio', ID: 401 },
      ],
    );
    const sink = makeFilter(
      5,
      'sink',
      [
        {
          pid_index: 0,
          name: 'audio_track_1',
          source_idx: 3,
          source_opid_idx: 0,
          stream_type: 'Audio',
          ID: 400,
        },
        {
          pid_index: 1,
          name: 'audio_track_1',
          source_idx: 3,
          source_opid_idx: 1,
          stream_type: 'Audio',
          ID: 401,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([src, sink], []);
    const edge0 = edges.find((e) => e.targetHandle === 'ipid-0');
    const edge1 = edges.find((e) => e.targetHandle === 'ipid-1');

    expect(edge0?.sourceHandle).toBe('opid-0');
    expect(edge1?.sourceHandle).toBe('opid-1');
  });

  it('maps each edge to a distinct sourceHandle for a demuxer fanning out multiple PIDs of the same stream_type to separate single-input sinks (regression: fut.mkv, 1 dmx -> N txtin)', () => {
    const dmx = makeFilter(
      6,
      'ffdmx',
      [],
      [
        { pid_index: 0, name: 'text1', stream_type: 'Text', ID: 10 },
        { pid_index: 1, name: 'text2', stream_type: 'Text', ID: 11 },
        { pid_index: 2, name: 'text3', stream_type: 'Text', ID: 12 },
      ],
    );
    const txtin1 = makeFilter(
      7,
      'txtin#1',
      [
        {
          pid_index: 0,
          name: 'text1',
          source_idx: 6,
          source_opid_idx: 0,
          stream_type: 'Text',
          ID: 10,
        },
      ],
      [],
    );
    const txtin2 = makeFilter(
      8,
      'txtin#2',
      [
        {
          pid_index: 0,
          name: 'text2',
          source_idx: 6,
          source_opid_idx: 1,
          stream_type: 'Text',
          ID: 11,
        },
      ],
      [],
    );
    const txtin3 = makeFilter(
      9,
      'txtin#3',
      [
        {
          pid_index: 0,
          name: 'text3',
          source_idx: 6,
          source_opid_idx: 2,
          stream_type: 'Text',
          ID: 12,
        },
      ],
      [],
    );

    const edges = createEdgesFromFilters([dmx, txtin1, txtin2, txtin3], []);

    expect(edges).toHaveLength(3);
    const sourceHandles = edges.map((e) => e.sourceHandle);
    expect(new Set(sourceHandles).size).toBe(3);
    expect(edges.find((e) => e.target === '7')?.sourceHandle).toBe('opid-0');
    expect(edges.find((e) => e.target === '8')?.sourceHandle).toBe('opid-1');
    expect(edges.find((e) => e.target === '9')?.sourceHandle).toBe('opid-2');
  });
});

describe('createNodesFromFilters', () => {
  it('creates one node per filter', () => {
    const filters: GraphFilterData[] = [
      makeFilter(
        0,
        'mp4dmx',
        [],
        [{ pid_index: 0, name: 'video', stream_type: 'Visual', ID: 500 }],
      ),
      makeFilter(
        1,
        'reframer',
        [
          {
            pid_index: 0,
            name: 'video',
            source_idx: 0,
            stream_type: 'Visual',
            ID: 500,
          },
        ],
        [],
      ),
    ];
    const nodes = createNodesFromFilters(filters);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id)).toEqual(['0', '1']);
  });
});
