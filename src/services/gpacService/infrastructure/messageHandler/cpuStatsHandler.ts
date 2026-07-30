import type { CPUStats } from '@/types/domain/system/index';

import { UpdatableSubscribable } from '@/services/utils/UpdatableSubcribable';
import { MessageThrottler } from '@/services/utils/MessageThrottler';
import { SubscriptionLifecycle } from '@/services/utils/SubscriptionLifecycle';
import { MessageHandlerDependencies } from './types';

import { generateID } from '@/utils/core';

const CPU_STATS_THROTTLE_MS = 500;

export class CPUStatsHandler {
  constructor(
    private dependencies: MessageHandlerDependencies,
    private isLoaded: () => boolean,
  ) {}

  private lifecycle = new SubscriptionLifecycle();
  private messageThrottler = new MessageThrottler();
  private cpuStatsSubscribable = new UpdatableSubscribable<CPUStats[]>([]);

  private ensureLoaded(): void {
    if (!this.isLoaded()) {
      throw new Error('Service not loaded');
    }
  }

  public subscribeToCPUStats(): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.subscribe(undefined, () =>
      this.dependencies.send({
        type: 'subscribe_cpu_stats',
        id: generateID(),
      }),
    );
  }

  public unsubscribeFromCPUStats(): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.unsubscribe(undefined, () =>
      this.dependencies.send({
        type: 'unsubscribe_cpu_stats',
        id: generateID(),
      }),
    );
  }

  public handleCPUStats(stats: CPUStats): void {
    if (!stats) {
      return;
    }

    this.messageThrottler.throttle(
      'cpu_stats',
      (data: CPUStats[]) => {
        this.cpuStatsSubscribable.updateDataAndNotify(data);
      },
      CPU_STATS_THROTTLE_MS,
      [stats],
    );
  }

  public subscribeToCPUStatsUpdates(
    callback: (stats: CPUStats) => void,
  ): () => void {
    this.lifecycle.cancelAutoUnsubscribe(undefined);

    const isFirstSubscriber = !this.cpuStatsSubscribable.hasSubscribers;

    const unsubscribe = this.cpuStatsSubscribable.subscribe(
      (data) => {
        if (data && data.length > 0) callback(data[data.length - 1]);
      },
      { immediate: false },
    );

    if (isFirstSubscriber) {
      this.subscribeToCPUStats().catch(() => {});
    }

    return () => {
      unsubscribe();

      if (!this.cpuStatsSubscribable.hasSubscribers) {
        this.lifecycle.scheduleAutoUnsubscribe(undefined, () => {
          if (!this.cpuStatsSubscribable.hasSubscribers) {
            this.unsubscribeFromCPUStats().catch(() => {});
          }
        });
      }
    };
  }

  public cleanup(): void {
    this.messageThrottler.clear();
    this.lifecycle.cleanup();
  }
}
