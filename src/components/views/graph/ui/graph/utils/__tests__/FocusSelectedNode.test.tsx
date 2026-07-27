import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import FocusSelectedNode from '../FocusSelectedNode';

const { mockFitView, mockGetNodes, mockSetNodes, selectedNodeIdState } =
  vi.hoisted(() => ({
    mockFitView: vi.fn(),
    mockGetNodes: vi.fn(),
    mockSetNodes: vi.fn(),
    selectedNodeIdState: { current: null as string | null },
  }));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    fitView: mockFitView,
    getNodes: mockGetNodes,
    setNodes: mockSetNodes,
  }),
}));

vi.mock('@/shared/hooks/redux', () => ({
  useAppSelector: () => selectedNodeIdState.current,
}));

describe('FocusSelectedNode', () => {
  beforeEach(() => {
    mockFitView.mockClear();
    mockSetNodes.mockClear();
    mockGetNodes.mockReset();
    mockGetNodes.mockReturnValue([
      { id: 'A', selected: false },
      { id: 'B', selected: false },
    ]);
    selectedNodeIdState.current = null;
  });

  it('focuses and highlights the selected node when it exists', () => {
    selectedNodeIdState.current = 'A';
    render(<FocusSelectedNode />);

    expect(mockFitView).toHaveBeenCalledTimes(1);
    expect(mockFitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: 'A' }] }),
    );

    const mapper = mockSetNodes.mock.calls[0][0];
    const result = mapper([
      { id: 'A', selected: false },
      { id: 'B', selected: false },
    ]);
    expect(result).toEqual([
      { id: 'A', selected: true },
      { id: 'B', selected: false },
    ]);
  });

  it('does not focus when the selected filter has no matching node (destroyed)', () => {
    selectedNodeIdState.current = 'ghost';
    render(<FocusSelectedNode />);

    expect(mockFitView).not.toHaveBeenCalled();
    expect(mockSetNodes).not.toHaveBeenCalled();
  });

  it('does not re-fire for an unchanged selection', () => {
    selectedNodeIdState.current = 'A';
    const { rerender } = render(<FocusSelectedNode />);
    expect(mockFitView).toHaveBeenCalledTimes(1);

    rerender(<FocusSelectedNode />);

    expect(mockFitView).toHaveBeenCalledTimes(1);
  });

  it('moves the highlight when the selection changes to another node', () => {
    selectedNodeIdState.current = 'A';
    const { rerender } = render(<FocusSelectedNode />);

    selectedNodeIdState.current = 'B';
    rerender(<FocusSelectedNode />);

    expect(mockFitView).toHaveBeenCalledTimes(2);
    expect(mockFitView).toHaveBeenLastCalledWith(
      expect.objectContaining({ nodes: [{ id: 'B' }] }),
    );

    const lastMapper = mockSetNodes.mock.calls[1][0];
    const result = lastMapper([
      { id: 'A', selected: true },
      { id: 'B', selected: false },
    ]);
    expect(result).toEqual([
      { id: 'A', selected: false },
      { id: 'B', selected: true },
    ]);
  });

  it('zooms back out and clears the highlight when returning to the dashboard', () => {
    selectedNodeIdState.current = 'A';
    const { rerender } = render(<FocusSelectedNode />);
    expect(mockFitView).toHaveBeenCalledTimes(1);

    selectedNodeIdState.current = null;
    rerender(<FocusSelectedNode />);

    expect(mockFitView).toHaveBeenCalledTimes(2);
    expect(mockFitView).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ nodes: expect.anything() }),
    );

    const lastMapper = mockSetNodes.mock.calls[1][0];
    const result = lastMapper([
      { id: 'A', selected: true },
      { id: 'B', selected: false },
    ]);
    expect(result).toEqual([
      { id: 'A', selected: false },
      { id: 'B', selected: false },
    ]);
  });
});
