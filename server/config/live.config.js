const UPDATE_INTERVALS = {
    SESSION_STATS: 1000,
    FILTER_STATS: 1000,
    CPU_STATS: 500,
};

// Bump on any front<->server CONTRACT change (new message, new field the front relies on,
// changed semantics)
const WS_PROTOCOL_VERSION = 1;

// Log retention strategy: preserve errors (100%), prioritize warnings (80%), sample info/debug (20%/5%)
const LOG_RETENTION = {
    maxHistorySize: 500,
    maxHistorySizeVerbose: 2000,
    keepRatio: {
        error: 1.0,
        warning: 0.8,
        info: 0.2,
        debug: 0.05
    }
};

export {
    UPDATE_INTERVALS,
    LOG_RETENTION,
    WS_PROTOCOL_VERSION,
};
