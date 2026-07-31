import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionStatsManager } from './SessionStatsManager.js';
import { cacheManager } from '../Cache/CacheManager.js';

function makeFakeClient() {
  return { client: { send: vi.fn() } };
}

describe('SessionStatsManager tick throttling', () => {
  let originalSession;

  beforeEach(() => {
    cacheManager.clear();
    originalSession = globalThis.session;
    globalThis.session = {
      nb_filters: 0,
      last_task: false,
      session_metrics: undefined,
      lock_filters() {},
      get_filter() { return null; },
    };
  });

  afterEach(() => {
    globalThis.session = originalSession;
  });

  it('ignores ticks from the shared loop faster than its own configured interval', () => {
    const client = makeFakeClient();
    const manager = new SessionStatsManager(client);
    manager.subscribe(1000, []);

    manager.tick(10000);
    manager.tick(10500); // shared loop running at cpu_stats' faster 500ms cadence

    expect(client.client.send).toHaveBeenCalledTimes(1);
  });

  it('sends again once its own interval has actually elapsed', () => {
    const client = makeFakeClient();
    const manager = new SessionStatsManager(client);
    manager.subscribe(1000, []);

    manager.tick(10000);
    manager.tick(10500);
    manager.tick(11000);

    expect(client.client.send).toHaveBeenCalledTimes(2);
  });
});
