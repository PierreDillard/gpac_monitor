import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import CustomNode from '../CustomNode';

vi.mock('@/shared/hooks/redux', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));

vi.mock('../../hooks/layout/useGraphColors', () => ({
  useGraphColors: () => ['#000000', '#ffffff'],
}));

const baseData = {
  idx: 1,
  name: 'mp4dmx',
  type: 'filter',
  status: 'running',
  itag: null,
  ID: null,
  label: 'mp4dmx',
  filterType: 'filter',
  nb_ipid: 1,
  nb_opid: 1,
  ipid: [{ pid_index: 0, name: 'video', source_idx: 0, stream_type: 'Visual' }],
  opid: [{ pid_index: 0, name: 'video', stream_type: 'Visual' }],
};

function renderCustomNode(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <CustomNode
        id="1"
        data={data as never}
        selected={false}
        type="gpac"
        dragging={false}
        zIndex={0}
        selectable={true}
        deletable={true}
        draggable={true}
        isConnectable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  );
}

describe('CustomNode null-safety', () => {
  it('renders normally when ipid/opid are populated arrays', () => {
    expect(() => renderCustomNode(baseData)).not.toThrow();
  });

  it('does not throw when ipid is null but nb_ipid is still > 0', () => {
    expect(() => renderCustomNode({ ...baseData, ipid: null })).not.toThrow();
  });

  it('does not throw when opid is undefined but nb_opid is still > 0', () => {
    expect(() =>
      renderCustomNode({ ...baseData, opid: undefined }),
    ).not.toThrow();
  });
});

describe('CustomNode layering', () => {
  it('uses an opaque mixed background to keep edges behind the node', () => {
    const { container } = renderCustomNode(baseData);
    const nodeContainer = container.querySelector('.border-2');

    expect(nodeContainer?.style.backgroundColor).toContain('color-mix');
  });
});

describe('CustomNode PID handles', () => {
  it.each(['input', 'output'])(
    'anchors %s handles inside their PID rows in display order',
    (direction) => {
      const pids = [
        { pid_index: 4, name: 'A01', stream_type: 'Audio', source_idx: 0 },
        { pid_index: 2, name: 'V02', stream_type: 'Visual', source_idx: 0 },
        { pid_index: 7, name: 'V03', stream_type: 'Visual', source_idx: 0 },
      ];
      const isInput = direction === 'input';
      const prefix = isInput ? 'ipid' : 'opid';
      const { container } = renderCustomNode({
        ...baseData,
        nb_ipid: isInput ? pids.length : 0,
        nb_opid: isInput ? 0 : pids.length,
        ipid: isInput ? pids : [],
        opid: isInput ? [] : pids,
      });
      const handles = Array.from(container.querySelectorAll('[data-handleid]'));

      expect(
        handles.map((handle) => handle.getAttribute('data-handleid')),
      ).toEqual(pids.map((pid) => `${prefix}-${pid.pid_index}`));
      for (const [index, handle] of handles.entries()) {
        const row = container.querySelector(`[title="${pids[index].name}"]`);
        expect(row).not.toBeNull();
        expect(row?.contains(handle)).toBe(true);
        expect(row?.textContent).toBe(pids[index].name);
        expect(row?.classList.contains('relative')).toBe(true);
        expect(row?.classList.contains('truncate')).toBe(false);
        expect(handle.classList.contains(isInput ? 'target' : 'source')).toBe(
          true,
        );
        expect(
          handle.classList.contains(
            isInput ? 'react-flow__handle-left' : 'react-flow__handle-right',
          ),
        ).toBe(true);
      }
    },
  );
});
