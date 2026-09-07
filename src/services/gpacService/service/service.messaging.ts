import { GpacServiceState } from './service.types';
import { GpacMessage } from '../../../types/communication/IgpacCommunication';
import { IGpacMessageHandler } from '../../../types/communication/IGpacMessageHandler';
import { GpacNotificationHandlers } from '../types';

export const messagingMethods = {
  /**
   * Send message to GPAC server (Promise wrapper)
   */
  async send(state: GpacServiceState, message: GpacMessage): Promise<void> {
    return Promise.resolve(messagingMethods.sendMessage(state, message));
  },

  /**
   * Send message to GPAC server immediately
   * Formats and sends via WebSocket
   */
  sendMessage(state: GpacServiceState, message: GpacMessage): void {
    if (!state.ws.isConnected()) {
      throw new Error('[GpacService] WebSocket not connected');
    }

    const formattedMessage = {
      message: message.type,
      ...message,
    };
    const jsonString = JSON.stringify(formattedMessage);
    state.ws.send(jsonString);
  },

  /**
   * Register custom message handler
   * Returns unregister function
   */
  registerHandler(
    state: GpacServiceState,
    handler: IGpacMessageHandler,
  ): () => void {
    return state.coreService.registerHandler(handler);
  },

  /**
   * Unregister custom message handler
   */
  unregisterHandler(
    state: GpacServiceState,
    handler: IGpacMessageHandler,
  ): void {
    state.coreService.unregisterHandler(handler);
  },

  /**
   * Set notification handlers for connection events
   */
  setNotificationHandlers(
    state: GpacServiceState,
    handlers: GpacNotificationHandlers,
  ): void {
    state.notificationHandlers = handlers;
    state.connectionManager.setNotificationHandlers(handlers);
    state.messageHandler.setNotificationHandlers(handlers);
  },
};
