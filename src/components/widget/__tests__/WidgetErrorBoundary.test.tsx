import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import WidgetErrorBoundary from '../WidgetErrorBoundary';

function BrokenChild(): ReactNode {
  throw new Error('render failed');
}

function FixedChild(): ReactNode {
  return <div>recovered</div>;
}

describe('WidgetErrorBoundary', () => {
  it('shows the fallback with the widget title and a Retry button when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <WidgetErrorBoundary widgetTitle="CPU monitor">
        <BrokenChild />
      </WidgetErrorBoundary>,
    );

    expect(screen.getByText(/CPU monitor failed to render/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();

    vi.restoreAllMocks();
  });

  it('logs the error via console.error instead of swallowing it', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <WidgetErrorBoundary widgetTitle="CPU monitor">
        <BrokenChild />
      </WidgetErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('remounts the children when Retry is clicked after the crash is fixed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function Sometimes({ broken }: { broken: boolean }): ReactNode {
      return broken ? <BrokenChild /> : <FixedChild />;
    }

    const { rerender } = render(
      <WidgetErrorBoundary widgetTitle="CPU monitor">
        <Sometimes broken={true} />
      </WidgetErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();

    rerender(
      <WidgetErrorBoundary widgetTitle="CPU monitor">
        <Sometimes broken={false} />
      </WidgetErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('recovered')).toBeDefined();

    vi.restoreAllMocks();
  });

  it('isolates a crash to its own boundary — a sibling widget keeps rendering', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <>
        <WidgetErrorBoundary widgetTitle="Broken widget">
          <BrokenChild />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetTitle="Healthy widget">
          <FixedChild />
        </WidgetErrorBoundary>
      </>,
    );

    expect(screen.getByText(/Broken widget failed to render/i)).toBeDefined();
    expect(screen.getByText('recovered')).toBeDefined();

    vi.restoreAllMocks();
  });
});
