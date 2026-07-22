const RATE_LIMIT_US = 1000 * 1000; // throttle recording: 1 event/s max
const CHUNK_DURATION_US = 10 * 1000 * 1000; // chunk duration: 10s
const MAX_LOG_PER_CHUNK = 5000;
const MAX_LOG_MESSAGE_LENGTH = 500; // raw log message truncation
const SEGMENT_DURATION_US = 24 * 60 * 60 * 1000 * 1000; // segment rollover: 24h
const DEFAULT_RETENTION_MAX_SEGMENTS = 30;
const HISTORY_RETENTION_UNLIMITED = -1;
const MANIFEST_REFRESH_US = 2 * 1000 * 1000; // periodic manifest rewrite: keeps torn sessions loadable

export {
    RATE_LIMIT_US,
    CHUNK_DURATION_US,
    MAX_LOG_PER_CHUNK,
    MAX_LOG_MESSAGE_LENGTH,
    SEGMENT_DURATION_US,
    DEFAULT_RETENTION_MAX_SEGMENTS,
    HISTORY_RETENTION_UNLIMITED,
    MANIFEST_REFRESH_US,
};
