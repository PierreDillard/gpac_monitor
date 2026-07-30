import type { MonitoredFilterStats } from '@/types/domain/gpac';
import { UpdatableSubscribable } from '@/services/utils/UpdatableSubcribable';
import { MessageThrottler } from '@/services/utils/MessageThrottler';
import { SubscriptionLifecycle } from '@/services/utils/SubscriptionLifecycle';
import { hydrateIpidFields } from '@/services/utils/hydrateIpidFields';
import { generateID } from '@/utils/core';
import { MessageHandlerDependencies } from './types';

const FILTER_STATS_THROTTLE_MS = 500;

export class FilterStatsHandler {
  constructor(
    private dependencies: MessageHandlerDependencies,
    private isLoaded: () => boolean,
  ) {}

  private lifecycle = new SubscriptionLifecycle<number>();
  private messageThrottler = new MessageThrottler();
  private filterStatsSubscribableMap = new Map<
    number,
    UpdatableSubscribable<MonitoredFilterStats>
  >();

  private ensureLoaded(): void {
    if (!this.isLoaded()) {
      throw new Error('Service not loaded');
    }
  }

  public subscribeToFilterStats(idx: number): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.subscribe(idx, () =>
      this.dependencies.send({
        type: 'subscribe_filter',
        id: generateID(),
        idx,
      }),
    );
  }

  public unsubscribeFromFilterStats(idx: number): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.unsubscribe(idx, () =>
      this.dependencies.send({
        type: 'unsubscribe_filter',
        id: generateID(),
        idx,
      }),
    );
  }

  public handleFilterStatsUpdate(filter: MonitoredFilterStats): void {
    const idx = filter.idx;
    const subscribable = this.filterStatsSubscribableMap.get(idx);
    if (!subscribable) return;

    const prev = subscribable.getSnapshot();
    if (prev?.ipids && filter.ipids) {
      for (const k of Object.keys(filter.ipids)) {
        if (!filter.ipids[k].properties && prev.ipids[k]?.properties) {
          filter.ipids[k].properties = prev.ipids[k].properties;
        }
      }
    }

    if (filter.ipids) {
      hydrateIpidFields(filter.ipids);
    }

    this.messageThrottler.throttle(
      `filter_stats_${idx}`,
      (data: MonitoredFilterStats) => {
        subscribable.updateDataAndNotify(data);
      },
      FILTER_STATS_THROTTLE_MS,
      filter,
    );
  }

  public subscribeToFilterStatsUpdates(
    idx: number,
    callback: (filter: MonitoredFilterStats) => void,
  ): () => void {
    this.lifecycle.cancelAutoUnsubscribe(idx);

    let subscribable = this.filterStatsSubscribableMap.get(idx);
    const isFirstSubscriber = !subscribable;

    if (!subscribable) {
      const initialData: MonitoredFilterStats = {
        idx,
        status: 'unknown',
        bytes_done: 0,
        bytes_sent: 0,
        pck_sent: 0,
        pck_done: 0,
        time: 0,
        nb_ipid: 0,
        nb_opid: 0,
      };
      subscribable = new UpdatableSubscribable(initialData);
      this.filterStatsSubscribableMap.set(idx, subscribable);
    }

    const unsubscribe = subscribable.subscribe(
      (data) => {
        if (data) callback(data);
      },
      { immediate: false },
    );

    if (isFirstSubscriber) {
      this.subscribeToFilterStats(idx).catch(() => {});
    }

    return () => {
      unsubscribe();
      const currentSubscribable = this.filterStatsSubscribableMap.get(idx);
      if (currentSubscribable && !currentSubscribable.hasSubscribers) {
        this.lifecycle.scheduleAutoUnsubscribe(idx, () => {
          const subscribable = this.filterStatsSubscribableMap.get(idx);
          if (subscribable && !subscribable.hasSubscribers) {
            this.filterStatsSubscribableMap.delete(idx);
            this.unsubscribeFromFilterStats(idx).catch(() => {});
          }
        });
      }
    };
  }

  public cleanup(): void {
    this.lifecycle.cleanup();
  }
}
