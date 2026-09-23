import { MessageHandler } from './Messaging/MessageHandler.js';
import { SessionStatsManager } from './Session/SessionStatsManager.js';
import { SessionManager } from './Session/SessionManager.js';
import { FilterManager } from './Filters/FilterManager.js';
import { CpuStatsManager } from './Sys/CpuStatsManager.js';
import { LogManager } from './Sys/LogManager.js';
import { CommandLineManager } from './CommandLineManager.js';
import { buildMonitorConfigPayload } from './buildMonitorConfigPayload.js';

function JSClient(id, client, all_clients, ensureMonitoringLoop, historyCollector) {
    this.id = id;
    this.client = client;
    this.ensureMonitoringLoop = ensureMonitoringLoop;
    this.historyCollector = historyCollector;

    this.messageHandler = new MessageHandler(this);
    this.sessionStatsManager = new SessionStatsManager(this);
    this.sessionManager = new SessionManager(this);
    this.filterManager = new FilterManager(this);
    this.cpuStatsManager = new CpuStatsManager(this);
    this.logManager = new LogManager(this);
    this.commandLineManager = new CommandLineManager(this);

    this.on_client_data = function(msg) {
        this.messageHandler.handleMessage(msg, all_clients);
    };

    this.sendMonitorConfig = function() {
        this.client.send(JSON.stringify(buildMonitorConfigPayload()));
    };

    this.cleanup = function() {
        try {
            this.logManager.forceUnsubscribe();
            this.sessionStatsManager.cleanup();
            this.cpuStatsManager.cleanup();
            this.filterManager.cleanup();
        } catch (error) {
            console.error(`JSClient ${this.id}: Error during cleanup:`, error);
        }
    };
}

export { JSClient };