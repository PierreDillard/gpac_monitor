import { Sys as sys } from 'gpaccore';
import { HistorySessionWriter } from './HistorySessionWriter.js';
import { SnapshotBuilder } from './SnapshotBuilder.js';
import { PidDataCollector } from '../JSClient/Filters/PID/PidDataCollector.js';
import { logHub } from '../JSClient/Sys/Utils/LogHub.js';
import { RATE_LIMIT_US, MAX_LOG_MESSAGE_LENGTH } from '../config/history.config.js';

const LOG_ID = '_hist_';
const LOG_LEVEL_ERROR = 1;
const LOG_LEVEL_WARNING = 2;

/**
 * HistoryCollector - taps the live session (graph/stats/logs/args) and forwards it to a HistorySessionWriter; no-op when historyDir is falsy.
 * @param {string} historyDir
 */
function HistoryCollector(historyDir) {
    this.snapshotBuilder = new SnapshotBuilder();
    this._graphVersion = null;
    this.enabled = !!historyDir;
    this.writer = new HistorySessionWriter(historyDir, undefined, {
        buildSegmentSnapshot: (rolloverTsUs) => this._buildRolloverSnapshot(rolloverTsUs),
    });
    this.pidCollector = new PidDataCollector();
    this.snapshotWritten = false;
    this.lastRecordUs = 0;
    this.lastCpuRecordUs = 0;
    this.pendingLogs = [];
    this.logBatchTimer = null;
    this._latestStructural = null;
    this._currentPidState = null;
    this._currentArgState = {};
    this._chunkNeedsCheckpoint = false;
    this._lastEventTsUs = 0;
  
    this._writeCheckpointIfNeeded = function(chunkIndex, tsUs) {
    if (!this._latestStructural) return;
    if (!this._chunkNeedsCheckpoint) return;
    if (chunkIndex <= 0) {
        this._chunkNeedsCheckpoint = false;
        return;
    }

    const checkpoint = {
        ts_us: tsUs,
        graph_v: this._latestStructural.graph_v,
        filters: this._latestStructural.filters,
        pid_state: this._currentPidState,
        metric_defs: session.session_metrics || null,
    };

    if (Object.keys(this._currentArgState).length > 0) {
        checkpoint.arg_state = this._currentArgState;
        this._currentArgState = {};
    }

    this.writer.writeCheckpoint(chunkIndex, checkpoint);
    this._chunkNeedsCheckpoint = false;
};

this._onChunkRotated = function() {
  const newChunkIndex = this.writer.getCurrentChunkIndex();
  this._writeCheckpointIfNeeded(newChunkIndex, this._lastEventTsUs);
};
    this.startLogCapture = function() {
        // Called at server start, before any client: captures the CLI log config
        this.initialLogConfig = sys.get_logs(true);
        logHub.add(LOG_ID, this);
    };

    this.writeSnapshot = function(data) {        if (this.snapshotWritten) return;
        data.log_config = this.initialLogConfig || null;
        this.writer.writeSnapshot(data);
        this.snapshotWritten = true;
    };

    this._buildRolloverSnapshot = function(rolloverTsUs) {
        let commandLine = null;
        try { commandLine = sys.args ? sys.args.join(' ') : null; } catch (_e) {}
        const snapshot = this.snapshotBuilder.build(this._graphVersion, commandLine);
        snapshot.ts_us = rolloverTsUs;
        return snapshot;
    };

this.recordGraph = function(filters, filterInstances, graphVersion) {
    this._graphVersion = graphVersion;
    // Builds the full graph payload used by snapshot and "filters" events.
    const pidCollector = new PidDataCollector();

    const eventFilters = filters.map((filter, index) => {
        const { ipid, opid, gpac_args, ...rest } = filter;
        const filterInstance = filterInstances[index];

        return {
            ...rest,
            ipids: ipid ?? [],
            opids: opid ?? [],
            gpac_args: filterInstance.all_args(true).filter(Boolean),
            properties: {
                ipids: pidCollector.collectInputPids(filterInstance, true),
                opids: pidCollector.collectOutputPids(filterInstance),
            },
        };
    });

    const checkpointFilters = eventFilters.map((filter) => {
        const { gpac_args, ...rest } = filter;
        const strippedIpids = Object.fromEntries(
            Object.entries(filter.properties.ipids).map(([k, v]) => {
                const { properties, ...pidRest } = v;
                return [k, pidRest];
            })
        );
        return {
            ...rest,
            properties: { ...filter.properties, ipids: strippedIpids },
        };
    });

    const filtersTsUs = sys.clock_us();
    this.writer.addEventIndex(filtersTsUs, 'graph-change');

    // Writes the initial full snapshot once.
    if (!this.snapshotWritten) {
        this.writeSnapshot({
            ts_us: filtersTsUs,
            command_line: null,
            graph_v: graphVersion,
            filters: eventFilters,
        });
    }

    // Writes the full "filters" event for history replay.
    const rotated = this.writer.writeEvent(JSON.stringify({
        message: 'filters',
        ts_us: filtersTsUs,
        graph_v: graphVersion,
        filters: eventFilters,
    }), filtersTsUs);
    this._lastEventTsUs = filtersTsUs;

    // Stores the structural baseline used by checkpoints.
    this._latestStructural = {
        graph_v: graphVersion,
        filters: checkpointFilters,
    };

    this._currentPidState = eventFilters.reduce((acc, filter) => {
        const allPidProperties = {};
        for (const [key, pid] of Object.entries(filter.properties.ipids)) {
            if (pid.properties) allPidProperties[key] = pid.properties;
        }
        if (Object.keys(allPidProperties).length > 0) acc[filter.idx] = allPidProperties;
        return acc;
    }, {});

    this._currentArgState = {};

    // Marks the current chunk as checkpoint-worthy.
    this._chunkNeedsCheckpoint = true;

    // Flushes checkpoint data if this write rotated to a new chunk.
    if (rotated) this._onChunkRotated(filtersTsUs);
};

    this.recordSessionStats = function(payload, force) {        const ts_us = sys.clock_us();
        if (!force && ts_us - this.lastRecordUs < RATE_LIMIT_US) return;
        this.lastRecordUs = ts_us;

        const filterMap = {};
        session.lock_filters(true);
        for (let i = 0; i < session.nb_filters; i++) {
            const f = session.get_filter(i);
            if (!f.is_destroyed()) filterMap[f.idx] = f;
        }
        const enrichedStats = payload.stats.map(stat => {
            const f = filterMap[stat.idx];
            if (!f) return stat;
            const entry = { ...stat };
            if (f.nb_ipid > 0) entry.ipids = this.pidCollector.collectInputPids(f, false, true);
            if (f.nb_opid > 0) entry.opids = this.pidCollector.collectOutputPids(f, true);
            return entry;
        });
        session.lock_filters(false);

        const rotated = this.writer.writeEvent(JSON.stringify({
            message: 'session_stats',
            ts_us,
            all_packets_done: payload.all_packets_done,
            stats: enrichedStats,
        }), ts_us);
        this._lastEventTsUs = ts_us;
        if (rotated) this._onChunkRotated(ts_us);
    };

    this.recordCpuStats = function(payload) {        const cpuTsUs = sys.clock_us();
        if (cpuTsUs - this.lastCpuRecordUs < RATE_LIMIT_US) return;
        this.lastCpuRecordUs = cpuTsUs;
        const rotated = this.writer.writeEvent(JSON.stringify({
            message: 'cpu_stats',
            ts_us: cpuTsUs,
            ...payload,
        }), cpuTsUs);
        this._lastEventTsUs = cpuTsUs;
        if (rotated) this._onChunkRotated(cpuTsUs);
    };

    this.recordPidReconfigured = function(indexes, pidsByFilter) {        const tsUs = sys.clock_us();
        this.writer.addEventIndex(tsUs, 'pid-reconfig');

        if (!this._currentPidState) {
            this._currentPidState = {};
        }

        for (const idx of indexes) {
            if (pidsByFilter[idx]) {
                const allPidProperties = {};
                for (const [key, pid] of Object.entries(pidsByFilter[idx])) {
                    if (pid.properties) allPidProperties[key] = pid.properties;
                }
                if (Object.keys(allPidProperties).length > 0) this._currentPidState[idx] = allPidProperties;
            }
        }
 if (indexes.length > 0) {
        this._chunkNeedsCheckpoint = true;
    }
       const rotated = this.writer.writeEvent(JSON.stringify({
        message: 'filter_pid_reconfigured',
        ts_us: tsUs,
        indexes,
        pidsByFilter,
    }), tsUs);
    this._lastEventTsUs = tsUs;

    if (rotated) this._onChunkRotated(tsUs);

    };

this.recordArgUpdated = function(indexes, argsByFilter) {    const tsUs = sys.clock_us();
    this.writer.addEventIndex(tsUs, 'args-change');

    for (const idx of indexes) {
        if (argsByFilter[idx]) {
            this._currentArgState[idx] = argsByFilter[idx];
        }
    }

    if (indexes.length > 0) {
        this._chunkNeedsCheckpoint = true;
    }

    const rotated = this.writer.writeEvent(JSON.stringify({
        message: 'filter_arg_updated',
        ts_us: tsUs,
        indexes,
        argsByFilter,
    }), tsUs);
    this._lastEventTsUs = tsUs;
    if (rotated) this._onChunkRotated(tsUs);
};

    this.recordFilterArgsUpdate = function(filterIdx, argName, newValue) {        const argsTsUs = sys.clock_us();
        const rotated = this.writer.writeEvent(JSON.stringify({
            message: 'filter_args_update',
            ts_us: argsTsUs,
            payload: { filter_idx: filterIdx, arg_name: argName, value: newValue },
        }), argsTsUs);
        this._lastEventTsUs = argsTsUs;
        if (rotated) this._onChunkRotated(argsTsUs);
    };

    this.recordLogConfigChanged = function(logLevel) {        const tsUs = sys.clock_us();
        this.writer.writeLog(JSON.stringify({
            message: 'log_config_changed',
            ts_us: tsUs,
            logLevel,
        }), tsUs);
        
    };

    this.handleLog = function(tool, level, message, thread_id, caller) {        this.pendingLogs.push({
            timestamp: sys.clock_us(),
            tool, level,
            message: message?.length > MAX_LOG_MESSAGE_LENGTH
                ? message.substring(0, MAX_LOG_MESSAGE_LENGTH) + '...'
                : message,
            thread_id,
            caller: caller?.idx !== undefined ? caller.idx : (caller?.name || null),
        });
        if (!this.logBatchTimer) {
            this.logBatchTimer = true;
            session.post_task(() => { this.flushLogs(); return false; });
        }
    };

    this.flushLogs = function() {
        if (this.pendingLogs.length) {
            const tsUs = sys.clock_us();
            this.writer.writeLog(JSON.stringify({
                message: 'log_batch',
                ts_us: tsUs,
                logs: this.pendingLogs,
            }), tsUs);
            this.pendingLogs.forEach((log) => {
                if (log.level !== LOG_LEVEL_ERROR && log.level !== LOG_LEVEL_WARNING) return;
                this.writer.recordJournalFact(log.timestamp, log.level);
            });
            this.pendingLogs = [];
        }
        this.logBatchTimer = null;
    };

    this.sendToClient = function(data) {
        if (data.message === 'log_config_changed') {
            this.recordLogConfigChanged(data.logLevel);
        }
    };

    this.close = function() {
        logHub.remove(LOG_ID);
        this.flushLogs();
        this.writer.close();
    };

    // No -rmt-log: recording disabled, every method becomes a no-op (zero disk I/O)
    if (!this.enabled) {
        this.snapshotWritten = true;
        for (const key in this) {
            if (typeof this[key] === 'function') this[key] = () => {};
        }
    }
}

export { HistoryCollector };
