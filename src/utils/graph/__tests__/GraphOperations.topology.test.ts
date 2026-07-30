import { describe, it, expect } from 'vitest';
import { createNodesFromFilters } from '../GraphOperations';
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

// Shape of the flist DASH session that froze the graph: one demuxer fanning
// out trackCount pids into 3 consecutive dense layers, then one sink per track
function makeDenseLayeredGraph(trackCount: number): GraphFilterData[] {
  const opids = (count: number) =>
    Array.from({ length: count }, (_, pidIndex) => ({
      pid_index: pidIndex,
      name: `track${pidIndex}`,
      stream_type: 'Text',
      ID: pidIndex,
    }));
  const ipidsFrom = (sourceIdx: number, count: number) =>
    Array.from({ length: count }, (_, pidIndex) => ({
      pid_index: pidIndex,
      name: `track${pidIndex}`,
      source_idx: sourceIdx,
      source_opid_idx: pidIndex,
      stream_type: 'Text',
      ID: pidIndex,
    }));

  const filters = [
    makeFilter(0, 'ffdmx', [], opids(trackCount)),
    makeFilter(1, 'flist', ipidsFrom(0, trackCount), opids(trackCount)),
    makeFilter(2, 'reframer', ipidsFrom(1, trackCount), opids(trackCount)),
    makeFilter(3, 'dasher', ipidsFrom(2, trackCount), opids(trackCount)),
  ];
  for (let track = 0; track < trackCount; track++) {
    filters.push(
      makeFilter(
        4 + track,
        `fout#${track}`,
        [
          {
            pid_index: 0,
            name: `track${track}`,
            source_idx: 3,
            source_opid_idx: track,
            stream_type: 'Text',
            ID: track,
          },
        ],
        [],
      ),
    );
  }
  return filters;
}

describe('createNodesFromFilters — dense layered graphs', () => {
  it('builds nodes for a 3-dense-layer session in bounded time (regression: flist+dash with 24 text tracks froze the tab for minutes)', () => {
    const filters = makeDenseLayeredGraph(24);

    const startMs = performance.now();
    const nodes = createNodesFromFilters(filters);
    const elapsedMs = performance.now() - startMs;

    expect(nodes).toHaveLength(filters.length);
    expect(elapsedMs).toBeLessThan(500);
  });

  it('positions filters left-to-right by dependency depth', () => {
    const filters = makeDenseLayeredGraph(3);
    const nodes = createNodesFromFilters(filters);

    const xOf = (id: string) =>
      nodes.find((node) => node.id === id)!.position.x;

    expect(xOf('0')).toBeLessThan(xOf('1'));
    expect(xOf('1')).toBeLessThan(xOf('2'));
    expect(xOf('2')).toBeLessThan(xOf('3'));
    expect(xOf('3')).toBeLessThan(xOf('4'));
  });
});
