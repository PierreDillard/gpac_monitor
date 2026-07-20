import * as os from 'os';
import { HistoryWriter } from './HistoryWriter.js';

function HistorySessionWriter(historyDir, sessionId) {
    const baseDir = historyDir || 'history';
    const id = sessionId || String(Date.now());
    const dir = `${baseDir}/${id}`;
    const segmentsDir = `${dir}/segments`;

    this.sessionId = id;
    this.sessionDir = dir;

    this._initialized = false;
    this._segmentWriter = null;
    this._eventsIndex = [];
    this._journalTsUs = [];
    this._journalTypes = [];

    this._init = function() {
        if (this._initialized) return;
        this._initialized = true;
        try { os.mkdir(baseDir); } catch (_e) {}
        try { os.mkdir(dir); } catch (_e) {}
        try { os.mkdir(segmentsDir); } catch (_e) {}
        this._segmentWriter = new HistoryWriter(segmentsDir, '0000');
    };

    this.writeSnapshot = function(obj) {
        this._init();
        this._segmentWriter.writeSnapshot(obj);
    };

    this.writeLog = function(jsonString, tsUs) {
        this._init();
        this._segmentWriter.writeLog(jsonString, tsUs);
    };

    this.writeEvent = function(jsonString, tsUs) {
        this._init();
        return this._segmentWriter.writeEvent(jsonString, tsUs);
    };

    this.writeCheckpoint = function(chunkIndex, obj) {
        this._init();
        this._segmentWriter.writeCheckpoint(chunkIndex, obj);
    };

    this.getCurrentChunkIndex = function() {
        this._init();
        return this._segmentWriter.getCurrentChunkIndex();
    };

    this.getCurrentLogChunkIndex = function() {
        this._init();
        return this._segmentWriter.getCurrentLogChunkIndex();
    };

    this.addEventIndex = function(tsUs, type, metadata) {
        if (!Number.isFinite(tsUs)) return;
        this._eventsIndex.push(metadata ? { ts_us: tsUs, type, ...metadata } : { ts_us: tsUs, type });
    };

    this.recordJournalFact = function(tsUs, type) {
        if (!Number.isFinite(tsUs)) return;
        this._journalTsUs.push(tsUs);
        this._journalTypes.push(type);
    };

    this.close = function() {
        this._init();
        this._segmentWriter.close();
    };
}

export { HistorySessionWriter };
