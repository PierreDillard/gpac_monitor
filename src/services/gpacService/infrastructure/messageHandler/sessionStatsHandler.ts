import { UpdatableSubscribable } from '@/services/utils/UpdatableSubcribable';
import { MessageThrottler } from '@/services/utils/MessageThrottler';
import { SubscriptionLifecycle } from '@/services/utils/SubscriptionLifecycle';
import { SessionFilterStatistics } from '@/types/domain/gpac/index';
import { generateID } from '@/utils/core';
import { MessageHandlerDependencies } from './types';

const SESSION_STATS_THROTTLE_MS = 500;

export class SessionStatsHandler {
  constructor(
    private dependencies: MessageHandlerDependencies,
    private isLoaded: () => boolean,
  ) {}

  private lifecycle = new SubscriptionLifecycle();
  private messageThrottler = new MessageThrottler();
  private sessionStatsSubscribable = new UpdatableSubscribable<
    SessionFilterStatistics[]
  >([]);

  private ensureLoaded(): void {
    if (!this.isLoaded()) {
      throw new Error('Service not loaded');
    }
  }

  public subscribeToSession(): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.subscribe(undefined, () =>
      this.dependencies.send({
        type: 'subscribe_session',
        id: generateID(),
      }),
    );
  }

  public unsubscribeFromSession(): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.unsubscribe(undefined, () =>
      this.dependencies.send({
        type: 'unsubscribe_session',
        id: generateID(),
      }),
    );
  }

  public handleSessionStats(stats: SessionFilterStatistics[]): void {
    this.messageThrottler.throttle(
      'session_stats',
      (data: SessionFilterStatistics[]) => {
        this.sessionStatsSubscribable.updateDataAndNotify(data);
      },
      SESSION_STATS_THROTTLE_MS,
      stats,
    );
  }

  public subscribeToSessionStats(
    callback: (stats: SessionFilterStatistics[]) => void,
  ): () => void {
    this.lifecycle.cancelAutoUnsubscribe(undefined);

    const isFirstSubscriber = !this.sessionStatsSubscribable.hasSubscribers;

    const unsubscribe = this.sessionStatsSubscribable.subscribe(
      (data) => {
        if (data) callback(data);
      },
      { immediate: true },
    );

    if (isFirstSubscriber) {
      this.subscribeToSession().catch(() => {});
    }

    return () => {
      unsubscribe();

      if (!this.sessionStatsSubscribable.hasSubscribers) {
        this.lifecycle.scheduleAutoUnsubscribe(undefined, () => {
          if (!this.sessionStatsSubscribable.hasSubscribers) {
            this.unsubscribeFromSession().catch(() => {});
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
