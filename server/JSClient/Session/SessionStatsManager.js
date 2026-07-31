import { DEFAULT_FILTER_FIELDS, UPDATE_INTERVALS } from '../config.js';
import { cacheManager } from '../Cache/CacheManager.js';

/**
 * SessionStatsManager - Manages session statistics collection
 *
 * Responsibilities:
 * - Subscribe/unsubscribe to session stats
 * - Send session_stats messages to client
 */
function SessionStatsManager(client) {
    this.client = client;
    this.isSubscribed = false;
    this.interval = UPDATE_INTERVALS.SESSION_STATS;
    this.fields = [];
    this.lastSentMetrics = '';
    this.lastSent = 0;

    this.subscribe = function(interval, fields) {
        this.isSubscribed = true;
        this.interval = interval || UPDATE_INTERVALS.SESSION_STATS;
        this.fields = fields || DEFAULT_FILTER_FIELDS;
        this.lastSent = 0;
    };

    this.unsubscribe = function() {
        this.isSubscribed = false;
    };

    /**
     * Compute if all filters with inputs have all PIDs EOS
     * @param {Array} filters - Active filters to check
     * @returns {boolean} true if all filters with inputs have all PIDs EOS
     */
    this.computeAllPacketsDone = function(filters) {
        if (filters.length === 0) return false;

        for (const f of filters) {
        
            if (f.nb_ipid === 0) continue;

           
            for (let i = 0; i < f.nb_ipid; i++) {
                const eos = f.ipid_props(i, 'eos');
                if (!eos) {
                    return false;
                }
            }
        }

        return true;
    };

    /**
     * Collect session statistics and send to client
     * Called by SessionManager on each tick
     */
    this.tick = function(now) {
        if (!this.isSubscribed) return;
        if (now - this.lastSent < this.interval) return;
        this.lastSent = now;

        // Use cache to avoid redundant serialization for multiple clients
        const serialized = cacheManager.getOrSet('session_stats', 50, () => {
            const stats = [];
            const filters = [];

            session.lock_filters(true);
            for (let i = 0; i < session.nb_filters; i++) {
                const f = session.get_filter(i);
                if (f.is_destroyed()) continue;

                filters.push(f);
                const obj = {};

                // Collect standard fields
                for (const field of this.fields) {
                    obj[field] = f[field];
                }

                // Calculate is_eos (all input PIDs are EOS)
                let allInputsEos = f.nb_ipid > 0;
                for (let j = 0; j < f.nb_ipid; j++) {
                    if (!f.ipid_props(j, 'eos')) {
                        allInputsEos = false;
                        break;
                    }
                }
                obj.is_eos = allInputsEos;

                // Media timestamp of last packet sent (Fraction or null)
                obj.last_ts_sent = f.last_ts_sent || null;

                stats.push(obj);
            }

            // Compute global all_packets_done
            const allFiltersEos = this.computeAllPacketsDone(filters);
            const all_packets_done = session.last_task && allFiltersEos;

            session.lock_filters(false);

            return JSON.stringify({
                message: 'session_stats',
                all_packets_done,
                ts_us: now,
                stats
            });
        });

        if (this.client.client) {
            this.client.client.send(serialized);
        }

        const sessionMetrics = session.session_metrics;
        if (sessionMetrics && sessionMetrics !== this.lastSentMetrics && this.client.client) {
            this.lastSentMetrics = sessionMetrics;
            this.client.client.send(JSON.stringify({
                message: 'session_metrics',
                data: sessionMetrics
            }));
           
        }
    };

    this.cleanup = function() {
        this.isSubscribed = false;
        this.lastSentMetrics = '';
    };

    this.handleSessionEnd = function() {
        this.unsubscribe();
    };
}

export { SessionStatsManager };
