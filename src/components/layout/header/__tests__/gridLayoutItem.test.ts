import { describe, it, expect, vi } from 'vitest';
import { toGridLayoutItem } from '../gridLayoutItem';
import { getWidgetDefinition } from '@/components/widget/registry';
import { WidgetType, type Widget } from '@/types/ui/widget';
import type { WidgetDefinition } from '@/components/widget/registry';

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'session-filters-1',
    type: WidgetType.FILTERSESSION,
    title: 'Session Filters',
    x: 0,
    y: 0,
    w: 18,
    h: 6,
    ...overrides,
  };
}

vi.mocked(getWidgetDefinition).mockReturnValue({
  minWidth: 10,
} as WidgetDefinition);

describe('toGridLayoutItem', () => {
  it('reads the minimum width from the widget definition', () => {
    expect(toGridLayoutItem(makeWidget()).minW).toBe(10);
  });

  it('widens a saved layout narrower than the minimum', () => {
    expect(toGridLayoutItem(makeWidget({ w: 6 })).w).toBe(10);
  });

  it('keeps the detached minimum for a detached widget', () => {
    const item = toGridLayoutItem(makeWidget({ w: 4, isDetached: true }));
    expect(item.minW).toBe(8);
    expect(item.w).toBe(8);
  });
});
