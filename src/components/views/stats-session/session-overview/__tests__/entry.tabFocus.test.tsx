import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const source = readFileSync(resolve(__dirname, '../entry.tsx'), 'utf-8');

describe('OverviewEntry — switching to a filter tab focuses the graph', () => {
  it('dispatches the selection when the tab handler resolves a filter', () => {
    const handler =
      source.match(
        /const handleTabChange = useCallback\(([\s\S]*?)\n {4}\);/,
      )?.[0] ?? '';

    expect(handler).toContain('setActiveTab(value)');
    expect(handler).toContain('getFilterIdxFromTab(value)');
    expect(handler).toContain('setSelectedNode(String(filterIdx))');
    expect(handler).toContain('clearSelectedNode()');
  });

  it('routes the auto-return-to-dashboard effect through the same handler, so the graph dezooms too', () => {
    const effect =
      source.match(
        /Return to dashboard[\s\S]*?\n {4}\}, \[activeTab, inlineFilterMap, handleTabChange\]\);/,
      )?.[0] ?? '';

    expect(effect).toContain("handleTabChange('main')");
  });

  it('routes the dashboard card click through the same handler as tab switching', () => {
    expect(source).toContain('useFilterHandlers(handleTabChange)');
  });

  it('wires StatsTabs onValueChange to the guarded tab-change handler, not raw setActiveTab', () => {
    const statsTabsBlock = source.match(/<StatsTabs[\s\S]*?\/>/)?.[0] ?? '';

    expect(statsTabsBlock).toContain('onValueChange={safeOnTabChange}');
  });
});
