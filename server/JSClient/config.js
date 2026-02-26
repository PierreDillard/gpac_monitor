const DEFAULT_FILTER_FIELDS = [
    "idx", "status", "bytes_done", "bytes_sent", "pck_sent", "pck_done", "time", "nb_ipid", "nb_opid", "errors", "current_errors"
];

const CPU_STATS_FIELDS = [
    "total_cpu_usage", "process_cpu_usage",
    "process_memory", "physical_memory", "physical_memory_avail",
    "gpac_memory", "thread_count",
];

const FILTER_PROPS_LITE = [
    'name', 'status', 'bytes_done', 'type', 'ID', 'nb_ipid', 'nb_opid', 'idx', 'itag', 'pck_sent', 'pck_done', 'time',"current_errors"
];

const FILTER_ARGS_LITE = [];

const PID_PROPS_LITE = [];

const FILTER_SUBSCRIPTION_FIELDS = [
    'status', 'bytes_done', 'bytes_sent', 'pck_done', 'pck_sent', 'time', 'nb_ipid', 'nb_opid', 'errors', 'current_errors'
];

const UPDATE_INTERVALS = {
    SESSION_STATS: 1000,
    FILTER_STATS: 1000,
    CPU_STATS: 500,
};


export {
    DEFAULT_FILTER_FIELDS,
    CPU_STATS_FIELDS,
    FILTER_PROPS_LITE,
    FILTER_ARGS_LITE,
    PID_PROPS_LITE,
    FILTER_SUBSCRIPTION_FIELDS,
    UPDATE_INTERVALS,
    LOG_RETENTION,
};