import { DetailsMessage } from '@/services/ws/types';

import { generateID } from '@/utils/core';
import { MessageHandlerDependencies } from './types';
import { UpdatableSubscribable } from '@/services/utils/UpdatableSubcribable';
import { SubscriptionLifecycle } from '@/services/utils/SubscriptionLifecycle';
import { FilterArgument } from '@/types';

export class FilterArgsHandler {
  constructor(
    private dependencies: MessageHandlerDependencies,
    private isLoaded: () => boolean,
  ) {}

  private lifecycle = new SubscriptionLifecycle<number>();
  private filterArgsSubscribables = new Map<
    number,
    UpdatableSubscribable<FilterArgument[]>
  >();

  private ensureLoaded(): void {
    if (!this.isLoaded()) {
      throw new Error('Service not loaded');
    }
  }

  public subscribeToFilterArgs(idx: number): Promise<void> {
    this.ensureLoaded();
    return this.lifecycle.subscribe(idx, () =>
      this.dependencies.send({
        type: 'filter_args_details',
        id: generateID(),
        idx,
      }),
    );
  }

  public handleFilterArgs(data: DetailsMessage): void {
    if (data.filter.idx === undefined) {
      return;
    }

    const filterIdx = data.filter.idx;
    const subscribable = this.filterArgsSubscribables.get(filterIdx);

    if (subscribable && data.filter.gpac_args) {
      subscribable.updateDataAndNotify(data.filter.gpac_args);
    }
  }

  public async updateFilterArg(
    idx: number,
    name: string,
    argName: string,
    newValue: string | number | boolean | null,
  ): Promise<void> {
    this.ensureLoaded();

    try {
      this.log(
        `Updating argument '${argName}' for filter ${name} (idx=${idx}) to value: ${newValue}`,
      );

      await this.dependencies.send({
        type: 'update_arg',
        id: generateID(),
        idx,
        name,
        argName,
        newValue,
      });

      this.log(
        `Successfully updated argument '${argName}' for filter ${name} (idx=${idx})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(
        `Error updating filter argument '${argName}' for ${name} (idx=${idx}): ${errorMessage}`,
        'stderr',
      );
      throw error;
    }
  }

  private log(message: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    if (type === 'stderr') {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  public subscribeToFilterArgsDetails(
    filterIdx: number,
    callback: (args: FilterArgument[]) => void,
  ): () => void {
    this.ensureLoaded();

    let subscribable = this.filterArgsSubscribables.get(filterIdx);
    const isFirstSubscriber = !subscribable;

    if (!subscribable) {
      subscribable = new UpdatableSubscribable<FilterArgument[]>([]);
      this.filterArgsSubscribables.set(filterIdx, subscribable);
    }
    const activeSubscribable = subscribable;

    const unsubscribe = activeSubscribable.subscribe(callback, {
      immediate: false,
    });

    if (isFirstSubscriber) {
      this.subscribeToFilterArgs(filterIdx);
    }

    return () => {
      unsubscribe();
      if (!activeSubscribable.hasSubscribers) {
        this.filterArgsSubscribables.delete(filterIdx);
      }
    };
  }

  public cleanup(): void {
    this.lifecycle.cleanup();
    this.filterArgsSubscribables.clear();
  }
}
