import { Sys as sys } from 'gpaccore';
import { logHub } from './Utils/LogHub.js';

/**
 * LogManager - Manages log subscription and batching for GPAC system logs
 * Captures GPAC logs, batches them for performance, and sends to WebSocket client
 */
function LogManager(client) {
    this.client = client;
    this.isSubscribed = false;
    this.logLevel = "all@warning";
    this.pendingLogs = [];
    this.batchTimer = null;

    this.subscribe = function(logLevel) {
        if (this.isSubscribed) {
            this.updateLogLevel(logLevel);
            return;
        }

        this.logLevel = logLevel;
        this.isSubscribed = true;

        try {
            logHub.add(this.client.id, this);
            if (logHub.activeLogLevel) {
                this.logLevel = logHub.activeLogLevel;
                this.sendToClient({ message: 'log_config_changed', logLevel: this.logLevel });
            } else {
                logHub.setLogLevel(this.logLevel);
            }
            this.client.ensureMonitoringLoop();
        } catch (error) {
            console.error("LogManager: Failed to start log capturing:", error);
            this.isSubscribed = false;
        }
    };

    this.unsubscribe = function() {
        if (!this.isSubscribed) return;

        try {
            this.flushPendingLogs();
            this.isSubscribed = false;
            logHub.remove(this.client.id);
            this.pendingLogs = [];
            this.batchTimer = null;
        } catch (error) {
            console.error("LogManager: Failed to stop log capturing:", error);
        }
    };

    this.handleLog = function(tool, level, message, thread_id, caller) {

        this.pendingLogs.push({
            timestamp: sys.clock_us(),
            timestampMs: Date.now(),
            tool,
            level,
            message: message?.length > 500 ? message.substring(0, 500) + '...' : message,
            thread_id,
            caller: caller?.idx !== undefined ? caller.idx : (caller?.name || null)
        });

        if (!this.batchTimer) {
            this.batchTimer = true;
            session.post_task(() => {
                if (!this.isSubscribed) return false;
                this.flushPendingLogs();
                return false;
            }, 50);
        }
    };

    /** No-op: tick kept for SessionManager compatibility */
    this.tick = function(now) {};

    this.updateLogLevel = function(logLevel) {
        if (!this.isSubscribed) return;
        try {
            this.pendingLogs = [];
            logHub.setLogLevel(logLevel);
        } catch (error) {
            console.error("LogManager: Failed to update log level:", error);
        }
    };

    this.getStatus = function() {
        return {
            isSubscribed: this.isSubscribed,
            logLevel: this.logLevel,
            currentLogConfig: sys.get_logs()
        };
    };

    this.flushPendingLogs = function() {
        if (this.pendingLogs.length === 0) {
            this.batchTimer = null;
            return;
        }
        this.sendToClient({ message: 'log_batch', logs: this.pendingLogs });
        this.pendingLogs = [];
        this.batchTimer = null;
    };

    this.sendToClient = function(data) {
        if (this.client.client && typeof this.client.client.send === 'function') {
            this.client.client.send(JSON.stringify(data));
        }
    };

    this.forceUnsubscribe = function() {
        try {
            this.flushPendingLogs();
            this.isSubscribed = false;
            logHub.remove(this.client.id);
            this.pendingLogs = [];
            this.batchTimer = null;
        } catch (error) {
            console.error("LogManager: Error during force cleanup:", error);
        }
    };

    this.handleSessionEnd = function() {
        logHub.shutdown();
        this.isSubscribed = false;
        this.pendingLogs = [];
        this.batchTimer = null;
    };
}

export { LogManager };
