import { Sys as sys } from 'gpaccore';

/** Ref-counted singleton owning sys.on_log — broadcasts to all subscribers */
const logHub = {
    subscribers: new Map(),
    originalLogConfig: null,
    activeLogLevel: null,
    sending: false,

    add(id, manager) {
        const wasEmpty = this.subscribers.size === 0;
        this.subscribers.set(id, manager);
        if (wasEmpty) {
            this.originalLogConfig = sys.get_logs(true);
            sys.use_logx = true;
            sys.on_log = (tool, level, msg, tid, caller) => {
                if (this.sending) return;
                for (const manager of this.subscribers.values()) manager.handleLog(tool, level, msg, tid, caller);
            };
        }
    },

    remove(id) {
        this.subscribers.delete(id);
        if (this.subscribers.size === 0) this._teardown();
    },

    /** Force-clear everything (session end) — stops all log capture immediately */
    shutdown() {
        this.subscribers.clear();
        this._teardown();
    },

    setLogLevel(logLevel) {
        this.activeLogLevel = logLevel;
        sys.set_logs(logLevel);
        for (const manager of this.subscribers.values()) {
            manager.logLevel = logLevel;
            manager.sendToClient({ message: 'log_config_changed', logLevel });
        }
    },

    _teardown() {
        sys.on_log = undefined;
        if (this.originalLogConfig) sys.set_logs(this.originalLogConfig);
        this.originalLogConfig = null;
        this.activeLogLevel = null;
    }
};

export { logHub };
