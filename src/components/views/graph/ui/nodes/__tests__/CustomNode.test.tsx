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
