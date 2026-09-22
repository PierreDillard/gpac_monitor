import { GpacTransport } from '../../../ws/GpacTransport';
import { GpacNotificationHandlers } from '../../types';
import { generateID } from '@/utils/core';
import { SessionStatsHandler } from './sessionStatsHandler';
import { FilterStatsHandler } from './filterStatsHandler';

import { WSMessageBatcher } from '../../../utils/WSMessageBatcher';

import { MessageHandlerCallbacks, MessageHandlerDependencies } from './types';
import { parseMetricDefinitions } from '@/utils/metrics/metricDefinitionParser';
import { checkProtocolVersionMismatch } from '@/services/ws/protocolVersion';
import { CPUStatsHandler } from './cpuStatsHandler';
import { FilterArgsHandler } from './filterArgsHandler';
import { LogHandler } from './logHandler';
import { PidPropsHandler } from './pidPropsHandler';
import { CommandLineHandler } from './commandLineHandler';
import {
  LogBatchResponse,
  LogHistoryResponse,
  LogStatusResponse,
  LogConfigChangedResponse,
  IncomingWsMessage,
  FiltersMessage,
  UpdateMessage,
  DetailsMessage,
  SessionStatsMessage,
  CpuStatsMessage,
  FilterStatsMessage,
  IpidPropsResponseMessage,
  SessionEndMessage,
} from '@/services/ws/types';

export type { MessageHandlerCallbacks, MessageHandlerDependencies };

export class BaseMessageHandler {
  private sessionStatsHandler: SessionStatsHandler;
  private filterStatsHandler: FilterStatsHandler;
  private cpuStatsHandler: CPUStatsHandler;
  private filterArgsHandler: FilterArgsHandler;
  private logHandler: LogHandler;
  private pidPropsHandler: PidPropsHandler;
  private commandLineHandler: CommandLineHandler;
  private messageBatcher: WSMessageBatcher;

  constructor(
    private notificationHandlers: GpacNotificationHandlers,
    private callbacks: MessageHandlerCallbacks,
    private dependencies: MessageHandlerDependencies,
    private onMessage?: (message: IncomingWsMessage) => void,
  ) {
    // Initialize message batcher (RAF-based batching for logs only)
    this.messageBatcher = new WSMessageBatcher();

    // Initialize specialized handlers
    this.sessionStatsHandler = new SessionStatsHandler(
      dependencies,
      () => true,
    );
    this.filterStatsHandler = new FilterStatsHandler(dependencies, () => true);
    this.cpuStatsHandler = new CPUStatsHandler(dependencies, () => true);
    this.filterArgsHandler = new FilterArgsHandler(dependencies, () => true);
    this.logHandler = new LogHandler(dependencies, () => true, callbacks);
    this.pidPropsHandler = new PidPropsHandler(dependencies);
    this.commandLineHandler = new CommandLineHandler(dependencies);

    // Register log batch handler (only high-frequency message type)
    this.messageBatcher.registerLogHandler((logs) => {
      this.logHandler.handleLogBatch(logs);
    });
  }

  public setNotificationHandlers(handlers: GpacNotificationHandlers): void {
    this.notificationHandlers = handlers;
  }

  // Expose handler methods
  public getSessionStatsHandler(): SessionStatsHandler {
    return this.sessionStatsHandler;
  }
  public getFilterStatsHandler(): FilterStatsHandler {
    return this.filterStatsHandler;
  }
  public getCPUStatsHandler(): CPUStatsHandler {
    return this.cpuStatsHandler;
  }
  public getFilterArgsHandler(): FilterArgsHandler {
    return this.filterArgsHandler;
  }
  public getLogHandler(): LogHandler {
    return this.logHandler;
  }
  public getPidPropsHandler(): PidPropsHandler {
    return this.pidPropsHandler;
  }
  public getCommandLineHandler(): CommandLineHandler {
    return this.commandLineHandler;
  }

  public handleJsonMessage(_: GpacTransport, dataView: DataView): void {
    try {
      const text = new TextDecoder().decode(dataView.buffer);
      const data = JSON.parse(text) as IncomingWsMessage;
      this.processGpacMessage(data);
    } catch (error) {
      // Error handling
    }
  }

  public handleDefaultMessage(_: GpacTransport, dataView: DataView): void {
    try {
      const text = new TextDecoder().decode(dataView.buffer);
      if (text.startsWith('{')) {
        const data = JSON.parse(text) as IncomingWsMessage;
        this.processGpacMessage(data);
      }
    } catch (error) {
      // Error handling
    }
  }

  private processGpacMessage(data: IncomingWsMessage): void {
    if (!data.message) {
      return;
    }

    switch (data.message) {
      case 'filters':
        this.handleFiltersMessage(data);
        break;
      case 'update':
        this.handleUpdateMessage(data);
        break;
      case 'details':
        this.handleDetailsMessage(data);
        break;
      case 'session_stats':
        this.handleSessionStatsMessage(data);
        break;
      case 'cpu_stats':
        this.handleCpuStatsMessage(data);
        break;
      case 'filter_stats':
        this.handleFilterStatsMessage(data);
        break;
      case 'log_batch':
        this.handleLogBatchMessage(data);
        break;
      case 'log_history':
        this.handleLogHistoryMessage(data);
        break;
      case 'log_status':
        this.handleLogStatusMessage(data);
        break;
      case 'log_config_changed':
        this.handleLogConfigChangedMessage(data);
        break;
      case 'ipid_props_response':
        this.handleIpidPropsResponseMessage(data);
        break;
      case 'command_line_response':
        this.commandLineHandler.handleCommandLineResponse(data);
        break;
      case 'filter_pid_reconfigured':
        this.callbacks.onPidReconfigured(data.indexes);
        break;
      case 'filter_arg_updated':
        this.callbacks.onArgUpdated(data.indexes);
        break;
      case 'session_metrics':
        this.callbacks.onSetMetricDefinitions(
          parseMetricDefinitions(data.data),
        );
        break;
      case 'monitor_config': {
        this.callbacks.onSetMonitorConfig(data.intervals);
        const versionMismatch = checkProtocolVersionMismatch(
          data.ws_protocol_version,
          data.gpac_version,
        );
        if (versionMismatch) {
          this.notificationHandlers.onProtocolVersionMismatch?.(
            versionMismatch,
          );
        }
        break;
      }
      case 'session_end':
        this.handleSessionEnd(data);
        break;
      case 'notification':
        this.notificationHandlers.onBackendNotification?.(
          data.type,
          data.description ?? '',
        );
        break;
      default: {
        const exhaustiveCheck: never = data;
        console.warn(
          `Unhandled message type: ${(exhaustiveCheck as IncomingWsMessage).message}`,
        );
        break;
      }
    }

    this.onMessage?.(data);
  }

  private handleFiltersMessage(data: FiltersMessage): void {
    this.callbacks.onSetLoading(false);
    this.callbacks.onUpdateGraphData(data.filters);

    if (data.filters) {
      this.callbacks.onFilterStatuses(
        data.filters.map((filter) => ({
          idx: filter.idx,
          status: filter.status,
        })),
      );
      data.filters.forEach((filter) => {
        this.notificationHandlers.onFilterUpdate?.(filter);
      });
    }
  }

  private handleUpdateMessage(data: UpdateMessage): void {
    if (Array.isArray(data.filters)) {
      this.callbacks.onUpdateGraphData(data.filters);
    }
  }

  private handleDetailsMessage(data: DetailsMessage): void {
    if (!data.filter) return;
    this.filterArgsHandler.handleFilterArgs(data);
  }

  private handleSessionStatsMessage(data: SessionStatsMessage): void {
    if (data.stats && Array.isArray(data.stats)) {
      this.callbacks.onFilterStatuses(
        data.stats.map((stat) => ({ idx: stat.idx, status: stat.status })),
      );
      this.sessionStatsHandler.handleSessionStats(data.stats);
      this.callbacks.onUpdateSessionStats({
        stats: data.stats,
        ts_us: data.ts_us,
      });
    }
  }

  private handleCpuStatsMessage(data: CpuStatsMessage): void {
    if (data.stats) {
      // Process immediately (low frequency: ~6 msgs/sec)
      this.cpuStatsHandler.handleCPUStats(data.stats);
    }
  }

  private handleFilterStatsMessage(data: FilterStatsMessage): void {
    if (data.idx !== undefined) {
      this.callbacks.onFilterStatuses([{ idx: data.idx, status: data.status }]);
      this.callbacks.onUpdateFilterStats({
        idx: data.idx,
        ts_us: data.ts_us,
        ipids: data.ipids,
        opids: data.opids,
        bytes_sent: data.bytes_sent ?? 0,
        bytes_done: data.bytes_done ?? 0,
        last_task_time: data.last_task_time,
      });
      // Process immediately (low frequency: ~1 msg/sec per filter)
      this.filterStatsHandler.handleFilterStatsUpdate(data);
    }
  }

  private handleLogBatchMessage(data: LogBatchResponse): void {
    if (data.logs && Array.isArray(data.logs)) {
      this.messageBatcher.addLogBatch(data);
    }
  }

  private handleLogHistoryMessage(data: LogHistoryResponse): void {
    if (data.logs && Array.isArray(data.logs)) {
      this.logHandler.handleLogHistory(data.logs);
    }
  }

  private handleLogStatusMessage(data: LogStatusResponse): void {
    if (data.status) {
      this.logHandler.handleLogStatus(data.status);
    }
  }

  private handleLogConfigChangedMessage(data: LogConfigChangedResponse): void {
    if (data.logLevel) {
      this.logHandler.handleLogConfigChanged(data.logLevel);
    }
  }

  private handleIpidPropsResponseMessage(data: IpidPropsResponseMessage): void {
    this.pidPropsHandler.handleIpidPropsResponse(data);
  }

  private handleSessionEnd(data: SessionEndMessage): void {
    // Mark as normal end of session (to avoid showing error message)
    this.dependencies.markEndOfSession();

    // Stop reconnection attempts immediately
    this.dependencies.stopReconnection();

    // Cleanup all resources immediately
    this.cleanup();

    // Notify callbacks (optional)
    if (this.callbacks.onSessionEnd) {
      this.callbacks.onSessionEnd(data);
    }
  }

  /**
   * Checks if the WebSocket client is connected
   *
   * @returns true if connected, throws an error otherwise
   */
  protected ensureConnected(): boolean {
    if (!this.dependencies.isConnected()) {
      const error = new Error('WebSocket client is not connected');
      throw error;
    }
    return true;
  }

  /**
   * Generate a unique ID for messages
   */
  protected static generateMessageId(): string {
    return generateID();
  }

  /**
   * Cleanup all handlers and timers (called on disconnect)
   */
  public cleanup(): void {
    // Clear message batcher
    this.messageBatcher.clear();

    // Cleanup all handlers with timeouts
    this.cpuStatsHandler.cleanup();
    this.sessionStatsHandler.cleanup();
    this.filterStatsHandler.cleanup();
    this.logHandler.cleanup();
    this.pidPropsHandler.cleanup();
  }
}
