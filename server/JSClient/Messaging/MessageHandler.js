import { Sys as sys } from 'gpaccore';
import { DEFAULT_FILTER_FIELDS, UPDATE_INTERVALS } from '../config.js';
import { cacheManager } from '../Cache/CacheManager.js';
import { HistoryFileReader } from '../../history/HistoryFileReader.js';

// Read from the same directory HistoryCollector writes to (-rmt-log)
const historyReader = new HistoryFileReader(sys.get_opt('core', 'rmt-log') || 'history');

function MessageHandler(client) {
    this.client = client;

    this.handleMessage = function(msg, all_clients) {
        let text = msg;
        if (text.startsWith("json:")) {
            try {
                let jtext = JSON.parse(text.substr(5));
                if (!('message' in jtext)) return;

                const handlers = {
                    'get_all_filters': () => {
                        this.client.filterManager.sendAllFilters();
                    },

                    'filter_args_details': () => {
                        let idx = jtext['idx'];
                        this.client.filterManager.requestDetails(idx);
                    },

                    'stop_filter_args': () => {
                        let idx = jtext['idx'];
                        this.client.filterManager.stopDetails(idx);
                    },

                    'subscribe_session': () => {
                        const interval = jtext['interval'] || UPDATE_INTERVALS.SESSION_STATS;
                        const fields = jtext['fields'] || DEFAULT_FILTER_FIELDS;
                        this.client.sessionStatsManager.subscribe(interval, fields);
                        this.client.ensureMonitoringLoop();
                    },

                    'unsubscribe_session': () => {
                        this.client.sessionStatsManager.unsubscribe();
                    },

                    'subscribe_filter': () => {
                        const idx = jtext.idx;
                        let pidScope = jtext.pidScope || 'both';
                        if(!pidScope) {
                            pidScope = 'both';
                        }
                        this.client.filterManager.subscribeToFilter(idx, pidScope);
                        this.client.ensureMonitoringLoop();
                    },
                    
                    'unsubscribe_filter': () => {
                        const idx = jtext.idx;
                        this.client.filterManager.unsubscribeFromFilter(idx);
                    },

                    'update_arg': () => {
                        this.client.filterManager.updateArgument(jtext['idx'], jtext['name'], jtext['argName'], jtext['newValue']);
                    },
             
                    
                    

                    'get_png': () => {
                        this.client.filterManager.addPngProbe(jtext['idx'], jtext['name']);
                    },

                    'subscribe_cpu_stats': () => {
                        const interval = jtext['interval'] || UPDATE_INTERVALS.CPU_STATS;
                        const fields = jtext['fields'] || [];
                        this.client.cpuStatsManager.subscribe(interval, fields);
                        this.client.ensureMonitoringLoop();
                    },

                    'unsubscribe_cpu_stats': () => {
                        this.client.cpuStatsManager.unsubscribe();
                    },

                    'subscribe_logs': () => {
                        const logLevel = jtext['logLevel'] || "all@warning";
                        this.client.logManager.subscribe(logLevel);
                        this.client.ensureMonitoringLoop();
                    },

                    'unsubscribe_logs': () => {
                        this.client.logManager.unsubscribe();
                    },

                    'update_log_level': () => {
                        const logLevel = jtext['logLevel'] || "all@warning";
                        this.client.logManager.updateLogLevel(logLevel);
                    },

                    'get_log_status': () => {
                        const status = this.client.logManager.getStatus();
                        this.client.client.send(JSON.stringify({
                            message: 'log_status',
                            status: status
                        }));
                    },

                    'get_ipid_props': () => {
                        const props = this.client.pidPropsCollector.collectIpidProps(
                            jtext['filterIdx'],
                            jtext['ipidIdx']
                        );
                        this.client.client.send(JSON.stringify({
                            message: 'ipid_props_response',
                            filterIdx: jtext['filterIdx'],
                            ipidIdx: jtext['ipidIdx'],
                            properties: props
                        }));
                    },

                    'get_command_line': () => {
                        this.client.commandLineManager.sendCommandLine();
                    },

                    'get_cache_stats': () => {
                        const stats = cacheManager.stats();
                        this.client.client.send(JSON.stringify({
                            message: 'cache_stats',
                            stats: stats
                        }));
                    },

                    'list_sessions': () => {
                        const sessions = historyReader.listSessions();
                        this.client.client.send(JSON.stringify({
                            command: 'list_sessions',
                            status: 'ok',
                            sessions
                        }));
                    },

                    'read_events_range': () => {
                        const { sessionId, fromUs, toUs } = jtext;
                        const events = historyReader.readEventsRange(sessionId, fromUs, toUs);
                        this.client.client.send(JSON.stringify({
                            command: 'events_range',
                            status: 'ok',
                            sessionId,
                            events,
                        }));
                    },

                    'read_file': () => {
                        const { sessionId, file } = jtext;
                        const result = historyReader.readFile(sessionId, file);
                        if (result.ok) {
                            this.client.client.send(JSON.stringify({
                                command: 'read_file',
                                status: 'ok',
                                sessionId,
                                file,
                                content: result.content
                            }));
                        } else {
                            this.client.client.send(JSON.stringify({
                                command: 'read_file',
                                status: 'error',
                                error: result.error,
                                detail: result.detail
                            }));
                        }
                    }
                };

                const handler = handlers[jtext['message']];
                if (handler) {
                    handler();
                }

            } catch (e) {
                console.error("MessageHandler: Error handling message:", e);
            }
        }
    };
}

export { MessageHandler };