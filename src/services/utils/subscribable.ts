import { generateID } from '@/utils/core';

type SubscriberFn<D, N = undefined, E extends object = ExtraData> = (
  data: D,
  type?: N[],
  extraData?: Partial<E>[],
) => void;

interface SubscriberOptions {
  debounce?: number;
  immediate?: boolean;
}

interface Channel<D, N = undefined, E extends object = ExtraData> {
  subscribers: Record<string, SubscriberFn<D, N, E>>;
  messages: {
    type: N;
    timestamp: number;
    extraData: Partial<E>;
  }[];
  timeout?: ReturnType<typeof setTimeout>;
  lastSent: number;
}

export type ErrorWithBreadcrumbs = Error;

interface ExtraData {
  error: ErrorWithBreadcrumbs;
}

export class Subscribable<D, N = undefined, E extends object = ExtraData> {
  protected data: D;

  /**
   * A list of channels grouped by their debounce time.
   * Each channel contains a list of subscribers and messages that are waiting to be sent.
   */
  #channels: Record<number, Channel<D, N, E>> = {};

  constructor(defaultData: D) {
    this.data = structuredClone(defaultData);
  }

  public get hasSubscribers() {
    return (
      Object.keys(this.#channels).length > 0 &&
      Object.values(this.#channels).some(
        (c) => Object.keys(c.subscribers).length > 0,
      )
    );
  }

  public subscribe(
    subscriber: SubscriberFn<D, N, E>,
    options: Partial<SubscriberOptions> = {},
  ) {
    const opts = {
      debounce: 150,
      immediate: true,
      ...options,
    };

    // Find the channel with the specified debounce time
    let channel = this.#channels[opts.debounce];
    if (!channel) {
      channel = {
        subscribers: {},
        messages: [],
        lastSent: -Infinity,
      };
      this.#channels[opts.debounce] = channel;
    }

    const id = generateID();
    channel.subscribers[id] = subscriber;

    // Send the initial data to the subscriber
    if (opts.immediate) subscriber(this.data);

    // Return a function that will remove the subscriber
    return () => {
      delete channel.subscribers[id];
      if (Object.keys(channel.subscribers).length === 0)
        delete this.#channels[opts.debounce];
    };
  }

  public getSnapshot() {
    return this.data;
  }

  /**
   * Notifies the subscribers with the specified type and extra data.
   *
   * @param type - The type of the notification.
   * @param extraData - Additional data to be included in the notification.
   * @note Depending on `debounce` option, the notifications will be batched and extraData will follow the same order as the types.
   */
  protected notify(type?: N, extraData?: Partial<E>) {
    // Add the notification to the list
    if (type)
      Object.values(this.#channels).forEach((channel) => {
        channel.messages.push({
          type,
          timestamp: performance.now(),
          extraData: extraData ?? {},
        });
      });

    // Cancel previous timeouts
    Object.values(this.#channels).forEach((channel) => {
      if (channel.timeout) clearTimeout(channel.timeout);
    });

    // Schedule to send the notifications
    Object.keys(this.#channels).forEach((debounce) => {
      const channel = this.#channels[Number(debounce)];

      channel.timeout = setTimeout(() => {
        // Decide on which messages to send
        const messages = channel.messages.filter(
          (m) => m.timestamp > channel.lastSent,
        );

        // Send the messages to all subscribers
        Object.values(channel.subscribers).forEach((subscriber) => {
          subscriber(
            this.data,
            messages.length === 0 ? undefined : messages.map((m) => m.type),
            messages.length === 0
              ? undefined
              : messages.map((m) => m.extraData),
          );
        });

        // Update the last sent timestamp
        channel.lastSent = performance.now();
        channel.messages = [];
      }, Number(debounce));
    });
  }
}
