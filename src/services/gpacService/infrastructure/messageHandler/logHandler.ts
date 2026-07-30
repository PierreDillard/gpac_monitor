import { UpdatableSubscribable } from '@/services/utils/UpdatableSubcribable';
import { SubscriptionLifecycle } from '@/services/utils/SubscriptionLifecycle';
import {
  GpacLogEntry,
  LogManagerStatus,
  GpacLogConfig,
  GpacLogConfigString,
} from '@/types/domain/gpac/log-types';
import { generateID } from '@/utils/core';
import { MessageHandlerDependencies, MessageHandlerCallbacks } from './types';
import { logWorkerService } from '@/services/workers/logWorkerService';

export class LogHandler {
  constructor(
    private dependencies: MessageHandlerDependencies,
    private isLoaded: () => boolean,
    private callbacks?: MessageHandlerCallbacks,
  ) {}

  private lifecycle = new SubscriptionLifecycle();
  private isSubscribed = false;
  private logEntriesSubscribable = new UpdatableSubscribable<GpacLogEntry[]>(
    [],
  );
  private logStatusSubscribable =
    new UpdatableSubscribable<LogManagerStatus | null>(null);
  private workerUnsubscribe: (() => void) | null = null;

  private ensureLoaded(): void {
    if (!this.isLoaded()) {
      throw new Error('Service not loaded');
    }
  }

  public async subscribeToLogs(
    logLevel: GpacLogConfig = 'all@quiet',
  ): Promise<void> {
    this.ensureLoaded();
    if (this.isSubscribed) return this.updateLogLevel(logLevel);
    return this.lifecycle.subscribe(undefined, async () => {
      await this.dependencies.send({
        type: 'subscribe_logs',
        id: generateID(),
        logLevel,
      });
      this.isSubscribed = true;
      this.callbacks?.onLogSubscriptionChange?.(true);
    });
  }

  public unsubscribeFromLogs(): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.unsubscribe(undefined, async () => {
      await this.dependencies.send({
        type: 'unsubscribe_logs',
        id: generateID(),
      });
      this.isSubscribed = false;
      this.callbacks?.onLogSubscriptionChange?.(false);
    });
  }

  public async updateLogLevel(logLevel: GpacLogConfigString): Promise<void> {
    this.ensureLoaded();
    await this.dependencies.send({
      type: 'update_log_level',
      id: generateID(),
      logLevel,
    });
  }

  public handleLogBatch(logs: GpacLogEntry[]): void {
    if (this.callbacks?.onLogsUpdate) {
      this.callbacks.onLogsUpdate(logs);
    }
  }

  public handleLogHistory(logs: GpacLogEntry[]): void {
    this.logEntriesSubscribable.updateDataAndNotify(logs);
    if (this.callbacks?.onLogsUpdate) {
      this.callbacks.onLogsUpdate(logs);
    } else {
      console.log(
        '[LogHandler] No onLogsUpdate callback available for history',
      );
    }
  }

  public handleLogStatus(status: LogManagerStatus): void {
    this.logStatusSubscribable.updateDataAndNotify(status);
  }

  public handleLogConfigChanged(logLevel: GpacLogConfig): void {
    const currentStatus = this.logStatusSubscribable.getSnapshot();
    if (currentStatus) {
      this.logStatusSubscribable.updateDataAndNotify({
        ...currentStatus,
        logLevel,
      });
    }
  }

  public subscribeToLogEntries(
    callback: (logs: GpacLogEntry[]) => void,
    logLevel: GpacLogConfig = 'all@warning',
  ): () => void {
    this.lifecycle.cancelAutoUnsubscribe(undefined);

    const isFirstSubscriber = !this.logEntriesSubscribable.hasSubscribers;

    if (!this.workerUnsubscribe) {
      this.workerUnsubscribe = logWorkerService.subscribe((processedLogs) => {
        this.logEntriesSubscribable.updateDataAndNotify(processedLogs);
      });
    }

    const unsubscribe = this.logEntriesSubscribable.subscribe(
      (data) => {
        if (data) callback(data);
      },
      { immediate: true },
    );

    if (isFirstSubscriber) {
      this.subscribeToLogs(logLevel).catch(() => {});
    }

    return () => {
      unsubscribe();

      if (!this.logEntriesSubscribable.hasSubscribers) {
        if (this.workerUnsubscribe) {
          this.workerUnsubscribe();
          this.workerUnsubscribe = null;
        }
        this.lifecycle.scheduleAutoUnsubscribe(undefined, () => {
          if (!this.logEntriesSubscribable.hasSubscribers) {
            this.unsubscribeFromLogs().catch(() => {});
          }
        });
      }
    };
  }

  public cleanup(): void {
    this.lifecycle.cleanup();
    if (this.workerUnsubscribe) {
      this.workerUnsubscribe();
      this.workerUnsubscribe = null;
    }
    logWorkerService.cleanup();
  }
}
