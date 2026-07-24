import { GpacServiceState, GpacServiceCallbacks } from './service.types';
import { ConnectionStatus } from '../../../types/communication/IgpacCommunication';
import type { GpacMessage } from '@/types/communication/shared';

export const initializationMethods = {
  /**
   * Setup WebSocket event handlers
   * Registers handlers for connect, disconnect, and message events
   */
  setupWebSocketHandlers(
    state: GpacServiceState,
    callbacks: GpacServiceCallbacks,
    sendMessage: (message: GpacMessage) => void,
    handleDisconnect: () => void,
  ): void {
    state.ws.addConnectHandler(() => {
      sendMessage({ type: 'get_all_filters' });
      callbacks.onConnectionStatusChange?.(ConnectionStatus.CONNECTED);
    });

    state.ws.addJsonMessageHandler(
      state.messageHandler.handleJsonMessage.bind(state.messageHandler),
    );
    state.ws.addDefaultMessageHandler(
      state.messageHandler.handleDefaultMessage.bind(state.messageHandler),
    );

    state.ws.addDisconnectHandler(() => {
      state.isLoaded = false;
      state.readyPromise = null;
      state.messageHandler.cleanup();
      callbacks.onConnectionStatusChange?.(ConnectionStatus.DISCONNECTED);
      callbacks.onDisconnect?.();
      handleDisconnect();
    });
  },

  /**
   * Load service and establish connection
   * Returns true if successful, throws on error
   */
  async load(
    state: GpacServiceState,
    callbacks: GpacServiceCallbacks,
    address: string,
    isConnected: () => boolean,
  ): Promise<boolean> {
    if (state.isLoaded) {
      return true;
    }

    try {
      callbacks.onConnectionStatusChange?.(ConnectionStatus.CONNECTING);
      await state.connectionManager.connect(address);
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!isConnected()) {
        throw new Error('Failed to establish connection');
      }

      state.isLoaded = true;
      return true;
    } catch (error) {
      state.isLoaded = false;
      callbacks.onConnectionStatusChange?.(ConnectionStatus.ERROR);
      throw error;
    }
  },

  /**
   * Cleanup service resources
   * Clears filters and subscriptions
   */
  cleanup(state: GpacServiceState): void {
    state.coreService.setCurrentFilterId(null);
    state.filterSubscriptionsStore.clear();
  },

  /**
   * Full disconnect cleanup
   * Cleanup handlers, disconnect websocket, clear store
   */
  disconnect(state: GpacServiceState): void {
    console.log('[GpacService] Disconnecting service');
    initializationMethods.cleanup(state);
    state.messageHandler.cleanup();
    state.connectionManager.disconnect();
  },
};
