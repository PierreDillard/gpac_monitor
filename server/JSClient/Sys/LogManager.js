import { Sys as sys } from 'gpaccore';

/**
 * LogManager - Manages log subscription and batching for GPAC system logs
 * Captures GPAC logs, batches them for performance, and sends to WebSocket client
 */
function LogManager(client) {
    this.client = client;
    this.isSubscribed = false;
    this.logLevel = "all@warning";
    this.originalLogConfig = null;
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
            this.originalLogConfig = sys.get_logs(true);
            sys.use_logx = true;
            sys.on_log = (tool, level, message, thread_id, caller) => {
                this.handleLog(tool, level, message, thread_id, caller);
            };
            sys.set_logs(this.logLevel);
            this.client.sessionManager.startMonitoringLoop();
        } catch (error) {
            console.error("LogManager: Failed to start log capturing:", error);
            this.isSubscribed = false;
        }
    };

    this.unsubscribe = function() {
        if (!this.isSubscribed) return;

        try {
            this.flushPendingLogs();
            sys.on_log = undefined;
            if (this.originalLogConfig) sys.set_logs(this.originalLogConfig);
            this.isSubscribed = false;
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
            this.logLevel = logLevel;
            sys.set_logs(logLevel);
            this.sendToClient({ message: 'log_config_changed', logLevel });
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
            sys.on_log = undefined;
            if (this.originalLogConfig) sys.set_logs(this.originalLogConfig);
            this.isSubscribed = false;
            this.pendingLogs = [];
            this.batchTimer = null;
        } catch (error) {
            console.error("LogManager: Error during force cleanup:", error);
        }
    };

    this.handleSessionEnd = function() {
        this.forceUnsubscribe();
    };
}

export { LogManager };
