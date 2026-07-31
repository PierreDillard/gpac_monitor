import { UPDATE_INTERVALS } from '../config.js';
import { cacheManager } from '../Cache/CacheManager.js';
import { buildCpuStatsPayload } from './buildCpuStatsPayload.js';

function CpuStatsManager(client) {
    this.client = client;
    this.isSubscribed = false;
    this.interval = UPDATE_INTERVALS.CPU_STATS;
    this.lastSent = 0;

    this.subscribe = function() {
        this.isSubscribed = true;
        this.interval = UPDATE_INTERVALS.CPU_STATS;
        this.lastSent = 0;

        this.client.ensureMonitoringLoop();
    };

    this.unsubscribe = function() {
        this.isSubscribed = false;
    };

    this.tick = function(now) {
        if (!this.isSubscribed) return;
        if (now - this.lastSent < this.interval * 1000) return;

        // Cache serialized data (50ms TTL) to avoid redundant JSON.stringify for concurrent clients
        const serialized = cacheManager.getOrSet('cpu_stats', 50, () => {
            const { stats } = buildCpuStatsPayload();
            return JSON.stringify({ message: 'cpu_stats', stats: { timestamp: now, ...stats } });
        });

        if (this.client.client) {
            this.client.client.send(serialized);
        }

        this.lastSent = now;
    };

    this.cleanup = function() {
        this.isSubscribed = false;
    };

    this.handleSessionEnd = function() {
        this.unsubscribe();
    };
}

export { CpuStatsManager };