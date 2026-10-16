import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../connectionManager';
import { GpacTransport } from '../../../ws/GpacTransport';
import { store } from '@/shared/store';
import { setError } from '@/shared/store/slices/graphSlice';

const createTransport = (connectResult: Promise<void>): GpacTransport => ({
  connect: () => connectResult,
  disconnect: () => {},
  isConnected: () => false,
  send: () => {},
  addMessageHandler: () => {},
  addJsonMessageHandler: () => {},
  addConnectHandler: () => {},
  addDisconnectHandler: () => {},
  addDefaultMessageHandler: () => {},
});

describe('ConnectionManager', () => {
  beforeEach(() => {
    store.dispatch(setError(null));
  });

  it('emits no notification and no error when the connection never opened', async () => {
    const manager = new ConnectionManager(
      createTransport(Promise.reject(new Error('refused'))),
    );
    const onError = vi.fn();
    const onConnectionStatus = vi.fn();
    manager.setNotificationHandlers({ onError, onConnectionStatus });

    await expect(manager.connect('ws://localhost:6363')).rejects.toThrow(
      'refused',
    );
    manager.handleDisconnect();

    expect(onError).not.toHaveBeenCalled();
    expect(onConnectionStatus).not.toHaveBeenCalled();
    expect(store.getState().graph.error).toBeNull();
  });

  it('reports a lost connection after it was established', async () => {
    const manager = new ConnectionManager(createTransport(Promise.resolve()));

    await manager.connect('ws://localhost:6363');
    manager.handleDisconnect();

    expect(store.getState().graph.error).toBe('Connection to GPAC server lost');
  });

  it('reports no error when an established session ends normally', async () => {
    const manager = new ConnectionManager(createTransport(Promise.resolve()));

    await manager.connect('ws://localhost:6363');
    manager.markEndOfSession();
    manager.handleDisconnect();

    expect(store.getState().graph.error).toBeNull();
  });
});
