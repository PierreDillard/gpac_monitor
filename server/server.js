import { Sys as sys } from 'gpaccore';
import { JSClient } from './JSClient/index.js';
import { HistoryCollector } from './history/HistoryCollector.js';
import { GraphManager } from './GraphManager.js';
import { buildSessionStatsPayload } from './JSClient/Session/buildSessionStatsPayload.js';
import { buildCpuStatsPayload } from './JSClient/Sys/buildCpuStatsPayload.js';
import { PidDataCollector } from './JSClient/Filters/PID/PidDataCollector.js';

// HISTORY — record only when gpac is launched with -rmt-log=<dir>
const recordPath = sys.get_opt("core", "rmt-log");
const historyCollector = new HistoryCollector(recordPath);
print(recordPath ? `[History] Recording enabled -> ${recordPath}` : '[History] Recording disabled (no -rmt-log)');

// GLOBAL STATE
let all_clients = [];
let cid = 0;
let filter_uid = 0;
let all_filters = [];

// GRAPH MANAGER
const graphManager = new GraphManager({
    getClients: () => all_clients,
    historyCollector,
    ensureMonitoringLoop,
});

// SHARED MONITORING LOOP (single post_task for all clients)
let monitoringRunning = false;

function ensureMonitoringLoop() {
    if (monitoringRunning) return;
    monitoringRunning = true;

    session.post_task(() => {
        const now = sys.clock_us();

        if (session.last_task) {
            for (const client of all_clients) client.sessionManager.handleSessionEnd(now);
            // Record final state before closing so history captures all EOS flags
            historyCollector.recordSessionStats(buildSessionStatsPayload(session), true);
            historyCollector.recordCpuStats(buildCpuStatsPayload());
            historyCollector.close();
            monitoringRunning = false;
            return false;
        }

        let active = false;
        let interval = 1000;
        for (const client of all_clients) {
            client.sessionManager.tick(now);
            if (client.sessionManager.hasActiveSubscriptions()) {
                active = true;
                interval = Math.min(interval, client.sessionManager.getMinInterval());
            }
        }

        // History: record session stats and cpu stats
        historyCollector.recordSessionStats(buildSessionStatsPayload(session));
        historyCollector.recordCpuStats(buildCpuStatsPayload());

        // Keep loop alive for history even without active client subscriptions
        return active ? interval : 1000;
    });
}


// SESSION CONFIGURATION
session.reporting(true);
historyCollector.startLogCapture();

// CLIENT MANAGEMENT
let remove_client = function(client_id) {
    for (let i = 0; i < all_clients.length; i++) {
        if (all_clients[i].id == client_id) {
            all_clients.splice(i, 1);
            return;
        }
    }
};

// FILTER EVENT HANDLERS
session.set_new_filter_fun((f) => {
    f.idx = filter_uid++;
    f.iname = '' + f.idx;
    all_filters.push(f);
    if (f.itag == "NODISPLAY") return;
    graphManager.onGraphEvent();
});

session.set_del_filter_fun((f) => {
    let idx = all_filters.indexOf(f);
    if (idx >= 0) all_filters.splice(idx, 1);
    if (f.itag == "NODISPLAY") return;
    graphManager.onGraphEvent();
});

const pidCollector = new PidDataCollector();

let pidReconfigured = new Set();
session.set_filter_pid_modified_fun((f) => {
    pidReconfigured.add(f.idx);
    if (pidReconfigured.size > 1) return;
    session.post_task(() => {
        const indexes = [...pidReconfigured];
        pidReconfigured.clear();
        const pidsByFilter = {};
        for (const idx of indexes) {
            const filter = all_filters.find(f => f.idx === idx);
            if (filter) pidsByFilter[idx] = pidCollector.collectInputPids(filter, true);
        }
        const msg = JSON.stringify({ message: 'filter_pid_reconfigured', indexes });
        for (const c of all_clients) if (c.client) c.client.send(msg);
        historyCollector.recordPidReconfigured(indexes, pidsByFilter);
        return false;
    });
});

let argUpdated = new Set();
session.set_filter_arg_updated_fun((f) => {
    argUpdated.add(f.idx);
    if (argUpdated.size > 1) return;
    session.post_task(() => {
        const indexes = [...argUpdated];
        argUpdated.clear();
        const argsByFilter = {};
        for (const idx of indexes) {
            const filter = all_filters.find(f => f.idx === idx);
            if (filter) argsByFilter[idx] = filter.all_args(true).filter(Boolean);
        }
        const msg = JSON.stringify({ message: 'filter_arg_updated', indexes });
        for (const c of all_clients) if (c.client) c.client.send(msg);
        historyCollector.recordArgUpdated(indexes, argsByFilter);
        return false;
    });
});


// WEBSOCKET CLIENT HANDLER
sys.rmt_on_new_client = function(client) {
    let js_client = new JSClient(++cid, client, all_clients, ensureMonitoringLoop, historyCollector);
    all_clients.push(js_client);
    js_client.sendMonitorConfig();

    js_client.client.on_data = (msg) => {
        if (typeof(msg) == "string")
            js_client.on_client_data(msg);
    };

    js_client.client.on_close = function() {
        js_client.cleanup();
        remove_client(js_client.id);
        js_client.client = null;
    };
};
