import { WebSocketBase } from '../ws/WebSocketBase';
import { GpacTransport } from '../ws/GpacTransport';
import {
  IGpacCommunication,
  GpacMessage,
  ConnectionStatus,
} from '../../types/communication/IgpacCommunication';
import { IGpacMessageHandler } from '../../types/communication/IGpacMessageHandler';
import type { IncomingWsMessage } from '../ws/types';
import { GpacNotificationHandlers } from './types';
import { ConnectionManager } from './infrastructure/connectionManager';
import { BaseMessageHandler } from './infrastructure/messageHandler/baseMessageHandler';
import { GpacCoreService } from './core/gpacCore';
import { createStoreCallbacks } from './liveAdapter/storeIntegration';
import {
  SubscriptionCallback,
  SubscriptionConfig,
} from '@/types/communication/subscription';
import { PidProperty } from '@/types';
import { FilterSubscriptionsStore } from './monitored-filter/FilterSubscriptionStore';

// Import modular methods
import {
  GpacServiceState,
  GpacServiceCallbacks,
} from './service/service.types';
import { initializationMethods } from './service/service.initialization';
import { connectionMethods } from './service/service.connection';
import { messagingMethods } from './service/service.messaging';
import { filterMethods } from './service/service.filters';
import { subscriptionMethods } from './service/service.subscriptions';

export class GpacService implements IGpacCommunication {
  // ============================================================================
  // SINGLETON
  // ============================================================================
  private static instance: GpacService | null = null;

  // ============================================================================
  // STATE
  // ============================================================================
  private state: GpacServiceState;
  private callbacks: GpacServiceCallbacks = {};

  public onConnectionStatusChange?: (status: ConnectionStatus) => void;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  private constructor(transport: GpacTransport = new WebSocketBase()) {
    const ws = transport;
    const coreService = new GpacCoreService();
    const connectionManager = new ConnectionManager(ws);
    const filterSubscriptionsStore = new FilterSubscriptionsStore();

    const storeCallbacks = createStoreCallbacks();

    const dependencies = {
      isConnected: () => this.isConnected(),
      send: (message: GpacMessage) => this.send(message),
      stopReconnection: () => connectionManager.stopReconnection(),
      markEndOfSession: () => connectionManager.markEndOfSession(),
    };

    const messageHandler = new BaseMessageHandler(
      {},
      storeCallbacks,
      dependencies,
      (message: IncomingWsMessage) => {
        coreService.notifyHandlers(message);
      },
    );

    this.state = {
      ws,
      coreService,
      connectionManager,
      messageHandler,
      notificationHandlers: {},
      filterSubscriptionsStore,
      isLoaded: false,
      readyPromise: null,
    };

    initializationMethods.setupWebSocketHandlers(
      this.state,
      this.callbacks,
      (msg) => this.sendMessage(msg),
      () => this.state.connectionManager.handleDisconnect(),
    );
  }

  public static getInstance(transport?: GpacTransport): GpacService {
    if (!GpacService.instance) {
      GpacService.instance = new GpacService(transport);
    }
    return GpacService.instance;
  }

  public async load(address: string): Promise<boolean> {
    return initializationMethods.load(this.state, this.callbacks, address, () =>
      this.isConnected(),
    );
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================
  public async connect(address: string): Promise<void> {
    return connectionMethods.connect(this.state, address);
  }

  public async connectService(address: string): Promise<void> {
    return connectionMethods.connect(this.state, address);
  }

  public disconnect(): void {
    initializationMethods.disconnect(this.state);
  }

  public isConnected(): boolean {
    return connectionMethods.isConnected(this.state);
  }

  public getConnectedAddress(): string | null {
    return connectionMethods.getAddress(this.state);
  }

  public isLoaded(): boolean {
    return connectionMethods.isLoaded(this.state);
  }

  public ready(address: string): Promise<void> {
    return connectionMethods.ready(this.state, address, (addr) =>
      this.load(addr),
    );
  }

  public getStatus(): ConnectionStatus {
    return connectionMethods.getStatus(this.state);
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================
  public send(message: GpacMessage): Promise<void> {
    return messagingMethods.send(this.state, message);
  }

  public sendMessage(message: GpacMessage): void {
    messagingMethods.sendMessage(this.state, message);
  }

  public registerHandler(handler: IGpacMessageHandler): () => void {
    return messagingMethods.registerHandler(this.state, handler);
  }

  public unregisterHandler(handler: IGpacMessageHandler): void {
    messagingMethods.unregisterHandler(this.state, handler);
  }

  public setNotificationHandlers(handlers: GpacNotificationHandlers): void {
    messagingMethods.setNotificationHandlers(this.state, handlers);
  }

  // ============================================================================
  // FILTER OPERATIONS
  // ============================================================================
  public getFilterDetails(idx: number): void {
    filterMethods.getFilterDetails(this.state, idx, (msg) =>
      this.sendMessage(msg),
    );
  }

  public setCurrentFilterId(id: number | null): void {
    filterMethods.setCurrentFilterId(this.state, id);
  }

  public getCurrentFilterId(): number | null {
    return filterMethods.getCurrentFilterId(this.state);
  }

  public async subscribeToFilterArgs(idx: number): Promise<void> {
    return filterMethods.subscribeToFilterArgs(this.state, idx);
  }

  public unsubscribeFromFilter(filterIdx: string): void {
    filterMethods.unsubscribeFromFilter(filterIdx, (msg) =>
      this.sendMessage(msg),
    );
  }

  public async updateFilterArg(
    idx: number,
    name: string,
    argName: string,
    newValue: string | number | boolean | null,
  ): Promise<void> {
    return filterMethods.updateFilterArg(
      this.state,
      idx,
      name,
      argName,
      newValue,
      () => this.isLoaded(),
    );
  }

  public getFilterArgsHandler() {
    return filterMethods.getFilterArgsHandler(this.state);
  }

  public get filterSubscriptions() {
    return filterMethods.getFilterSubscriptions(this.state);
  }

  // ============================================================================
  // PID FETCHING
  // ============================================================================
  public async getPidProps(
    filterIdx: number | undefined,
    ipidIdx: number | undefined,
  ): Promise<PidProperty[]> {
    return filterMethods.getPidProps(this.state, filterIdx, ipidIdx, () =>
      this.isLoaded(),
    );
  }

  public async getCommandLine(): Promise<string | null> {
    return filterMethods.getCommandLine(this.state, () => this.isLoaded());
  }

  // ============================================================================
  // LOGS
  // ============================================================================
  public get logs() {
    return subscriptionMethods.getLogs(this.state);
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  public async subscribe<T = unknown>(
    config: SubscriptionConfig,
    callback: SubscriptionCallback<T>,
  ): Promise<() => void> {
    return subscriptionMethods.subscribe(this.state, config, callback, () =>
      this.isLoaded(),
    );
  }
}

export const gpacService = GpacService.getInstance();
