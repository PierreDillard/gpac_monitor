import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import connectionsReducer from '../../../store/slices/connectionsSlice';
import { useServiceReady } from '../useServiceReady';
import { gpacService } from '@/services/gpacService';

vi.mock('@/services/gpacService', () => ({
  gpacService: { ready: vi.fn().mockResolvedValue(undefined) },
}));

const mockUseDataSource = vi.fn();
vi.mock('@/services/dataSource/DataSourceContext', () => ({
  useDataSource: () => mockUseDataSource(),
}));

const makeStore = () =>
  configureStore({ reducer: { connections: connectionsReducer } });

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

describe('useServiceReady — history mode must never open the live WS', () => {
  beforeEach(() => {
    vi.mocked(gpacService.ready).mockClear();
  });

  it('does not call gpacService.ready in history mode', () => {
    mockUseDataSource.mockReturnValue({ mode: 'history' });
    const { result } = renderHook(() => useServiceReady(), {
      wrapper: makeWrapper(makeStore()),
    });

    expect(gpacService.ready).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('calls gpacService.ready with the active address in live mode', async () => {
    mockUseDataSource.mockReturnValue({ mode: 'live' });
    const { result } = renderHook(() => useServiceReady(), {
      wrapper: makeWrapper(makeStore()),
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(gpacService.ready).toHaveBeenCalledWith('ws://localhost:6363');
  });
});
