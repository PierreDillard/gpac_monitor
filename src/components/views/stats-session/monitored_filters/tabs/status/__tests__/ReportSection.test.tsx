import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportSection from '../ReportSection';
import type { NumericMetric } from '../../../utils/statusViewModel';
import type { MetricDefinitionMap } from '@/utils/metrics/metricDefinitionParser';

function makeMetric(key: string, value: string): NumericMetric {
  return {
    key,
    value,
    rawValue: null,
    graphable: false,
    completionSnapshot: true,
  };
}

const twoMetrics = [makeMetric('fps', '109.57'), makeMetric('frames', '13')];

describe('ReportSection', () => {
  it('renders nothing when metrics is empty', () => {
    const { container } = render(<ReportSection metrics={[]} isDone={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses metric.key as label when no definition exists', () => {
    render(<ReportSection metrics={twoMetrics} isDone={false} />);
    expect(screen.getByText('fps')).toBeInTheDocument();
    expect(screen.getByText('frames')).toBeInTheDocument();
  });

  it('uses definition label instead of raw key', () => {
    const definitions: MetricDefinitionMap = {
      fps: { type: 'num', label: 'Frame rate', freg: '*' },
    };
    render(
      <ReportSection
        metrics={twoMetrics}
        definitions={definitions}
        isDone={false}
      />,
    );
    expect(screen.getByText('Frame rate')).toBeInTheDocument();
    expect(screen.queryByText('fps')).not.toBeInTheDocument();
  });

  it('renders metric values', () => {
    render(<ReportSection metrics={twoMetrics} isDone={false} />);
    expect(screen.getByText('109.57')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('splits 6 metrics into 3 columns of 2', () => {
    const metrics = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) =>
      makeMetric(key, key),
    );
    render(<ReportSection metrics={metrics} isDone={false} />);
    const tables = document.querySelectorAll('table');
    expect(tables).toHaveLength(3);
    tables.forEach((table) =>
      expect(table.querySelectorAll('tr')).toHaveLength(2),
    );
  });

  it('shows Report header', () => {
    render(<ReportSection metrics={twoMetrics} isDone={false} />);
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  describe('Done row', () => {
    it('does not show Done row when isDone is false', () => {
      render(<ReportSection metrics={twoMetrics} isDone={false} />);
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
      expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });

    it('shows Done row at top of first column when isDone is true', () => {
      render(<ReportSection metrics={twoMetrics} isDone={true} />);
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });
});
