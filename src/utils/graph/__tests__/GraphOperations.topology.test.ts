import { describe, it, expect } from 'vitest';
import {
  createEdgesFromFilters,
  createNodesFromFilters,
} from '../GraphOperations';
import { GraphFilterData } from '@/types/domain/gpac';
import filtersFixture from '@/services/ws/__tests__/fixtures/filters.json';

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

describe('createEdgesFromFilters — real GPAC filters reply', () => {
  it('links avgen → reframer → inspect by PID name, identifying filters by type', () => {
    const filters = filtersFixture.filters as GraphFilterData[];
    const filterByIdx = new Map(
      filters.map((filter) => [String(filter.idx), filter]),
    );
    const pidIndexOf = (handle: string | null | undefined) =>
      Number(handle?.split('-')[1]);

    const links = createEdgesFromFilters(filters, []).map((edge) => {
      const source = filterByIdx.get(edge.source);
      const target = filterByIdx.get(edge.target);
      const sourcePid = source?.opid[pidIndexOf(edge.sourceHandle)]?.name;
      const targetPid = target?.ipid[pidIndexOf(edge.targetHandle)]?.name;
      return `${source?.type}.${sourcePid} -> ${target?.type}.${targetPid}`;
    });

    expect(links.sort()).toEqual([
      'jsf.audio -> reframer.audio',
      'jsf.video -> reframer.video',
      'reframer.audio -> inspect.audio',
      'reframer.video -> inspect.video',
    ]);
  });
});
