
import { Sys as sys } from 'gpaccore';
import { UPDATE_INTERVALS, LOG_RETENTION, WS_PROTOCOL_VERSION } from './config.js';

function buildMonitorConfigPayload() {
    let gpac_version = null;
    try {
        gpac_version = sys.version_full || null;
    } catch (_e) {
        gpac_version = null;
    }

    const payload = {
        message: 'monitor_config',
        intervals: UPDATE_INTERVALS,
        logRetention: LOG_RETENTION,
        ws_protocol_version: WS_PROTOCOL_VERSION,
        gpac_version, 
    };
    return payload;
}

export { buildMonitorConfigPayload };
