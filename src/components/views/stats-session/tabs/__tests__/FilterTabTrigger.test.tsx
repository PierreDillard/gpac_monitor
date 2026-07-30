import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList } from '@/components/ui/tabs';
import { FilterTabTrigger } from '../components/FilterTabTrigger';

describe('FilterTabTrigger — close icon must not select the tab', () => {
  it('closes without re-selecting the tab it sits on', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    const handleCloseTab = vi.fn();

    const { getByText } = render(
      <Tabs value="main" onValueChange={handleValueChange}>
        <TabsList>
          <FilterTabTrigger
            filterIdx={2}
            filterName="txtin"
            isHistory={false}
            onValueChange={handleValueChange}
            onCloseTab={handleCloseTab}
          />
        </TabsList>
      </Tabs>,
    );

    await user.click(getByText('×'));

    expect(handleCloseTab).toHaveBeenCalledWith(2, expect.anything());
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('detach icon does not select the tab it sits on', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    const handleDetachTab = vi.fn();

    const { getByTitle } = render(
      <Tabs value="main" onValueChange={handleValueChange}>
        <TabsList>
          <FilterTabTrigger
            filterIdx={3}
            filterName="dec"
            isHistory={false}
            onValueChange={handleValueChange}
            onCloseTab={vi.fn()}
            onDetachTab={handleDetachTab}
          />
        </TabsList>
      </Tabs>,
    );

    await user.click(getByTitle('Detach as overlay'));

    expect(handleDetachTab).toHaveBeenCalledWith(3, 'dec', expect.anything());
    expect(handleValueChange).not.toHaveBeenCalled();
  });
});
