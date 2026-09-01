import { describe, it, expect, beforeEach } from 'vitest';
import { selectNodesForGraphMonitor } from '../graph/graphSelectors';
import type { RootState } from '../../index';
import type {
  SessionFilterStats,
  SessionStatsState,
} from '../../slices/sessionStatsSlice';
import type { GraphState } from '../../slices/graphSlice';
import type { GpacNode } from '@/types/domain/gpac/model';

const makeFilter = (bytes: number): SessionFilterStats => ({
  idx: 0,
  status: '',
  bytes_done: bytes,
  bytes_sent: 0,
  pck_sent: 5,
  pck_done: 5,
  nb_opid: 1,
  nb_ipid: 1,
  time: 1000,
  is_eos: false,
});

const makeNode = (id: string): GpacNode => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    name: `Filter ${id}`,
    type: 'filter',
    idx: Number(id),
    ID: null,
    itag: null,
    nb_ipid: 1,
    nb_opid: 1,
    ipid: {},
    opid: {},
    status: '',
    bytes_done: 0,
    bytes_sent: 0,
    pck_done: 0,
    pck_sent: 0,
    time: 0,
  },
});

const sharedGraph: GraphState = {
  filters: [],
  nodes: [makeNode('0')],
  edges: [],
  isLoading: false,
  error: null,
  redraw: false,
  selectedNodeId: null,
  initialTab: null,
  pendingFilterOpen: null,
  pidReconfiguredFilters: [],
  argUpdatedFilters: [],
  lastUpdate: 0,
};

const makeState = (
  sessionStats: Record<string, SessionFilterStats>,
  previousSessionStats: Record<string, SessionFilterStats>,
): RootState =>
  ({
    graph: sharedGraph,
    sessionStats: {
      sessionStats,
      previousSessionStats,
      mode: 'session',
      selectedFilterId: null,
      lastUpdate: null,
      lastUpdateUs: null,
      sessionStartUs: null,
      isLoading: false,
      subscribedComponents: [],
      isSubscribed: false,
      metricDefinitions: {},
    } satisfies SessionStatsState,
  }) as unknown as RootState;

describe('selectNodesForGraphMonitor', () => {
  beforeEach(() => {
    selectNodesForGraphMonitor.resetRecomputations();
  });

  it('does not recompute when stats tick but stalled values unchanged', () => {
    const stalled = makeFilter(100);
    const state1 = makeState({ '0': stalled }, { '0': stalled });
    const state2 = makeState({ '0': stalled }, { '0': stalled });

    const result1 = selectNodesForGraphMonitor(state1);
    const recomputationsBefore = selectNodesForGraphMonitor.recomputations();

    const result2 = selectNodesForGraphMonitor(state2);

    expect(result1).toBe(result2);
    expect(selectNodesForGraphMonitor.recomputations()).toBe(
      recomputationsBefore,
    );
  });

  it('does not recompute when a filter flips to stalled — sessionStats is not a dependency', () => {
    const stateActive = makeState(
      { '0': makeFilter(200) },
      { '0': makeFilter(100) },
    );
    const filter = makeFilter(100);
    const stateStalled = makeState({ '0': filter }, { '0': filter });

    const result1 = selectNodesForGraphMonitor(stateActive);
    const recomputationsBefore = selectNodesForGraphMonitor.recomputations();

    const result2 = selectNodesForGraphMonitor(stateStalled);

    expect(result2).toBe(result1);
    expect(selectNodesForGraphMonitor.recomputations()).toBe(
      recomputationsBefore,
    );
    expect(result1[0].data).not.toHaveProperty('isStalled');
  });
});
