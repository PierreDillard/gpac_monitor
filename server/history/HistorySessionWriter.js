import * as os from 'os';
import { HistoryWriter, writeFileAtomic } from './HistoryWriter.js';
import { buildJournalPointer, serializeJournalIndex } from './helpers/journalIndex.js';
import { SEGMENT_DURATION_US, DEFAULT_RETENTION_MAX_SEGMENTS } from '../config/history.config.js';

function HistorySessionWriter(historyDir, sessionId) {
    const baseDir = historyDir || 'history';
    const id = sessionId || String(Date.now());
    const dir = `${baseDir}/${id}`;
    const segmentsDir = `${dir}/segments`;

    this.sessionId = id;
    this.sessionDir = dir;

    this._initialized = false;
    this._segmentWriter = null;
    this._segments = [];
    this._sessionStartUs = null;
    this._lastEventUs = null;
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
        this._segments.push({ index: 0, dir: 'segments/0000', fromUs: null, toUs: null, pinned: false, done: false });
    };

    this._currentSegment = function() {
        return this._segments[this._segments.length - 1];
    };

    this._updateTimestamps = function(tsUs) {
        if (this._sessionStartUs === null) this._sessionStartUs = tsUs;
        this._lastEventUs = tsUs;
        const segment = this._currentSegment();
        if (segment.fromUs === null) segment.fromUs = tsUs;
    };

    this._getEventsIndexPointer = function() {
        if (this._eventsIndex.length === 0) return undefined;
        return { file: 'events_index.json', format: 'array-v1', eventCount: this._eventsIndex.length };
    };

    this._writeEventsIndex = function() {
        if (this._eventsIndex.length === 0) return;
        const sorted = [...this._eventsIndex].sort((a, b) => a.ts_us - b.ts_us);
        writeFileAtomic(`${dir}/events_index.json`, JSON.stringify(sorted) + '\n');
    };

    this._writeJournalIndex = function() {
        if (this._journalTsUs.length === 0) return;
        writeFileAtomic(
            `${dir}/journal_index.json`,
            JSON.stringify(serializeJournalIndex(this._journalTsUs, this._journalTypes)) + '\n'
        );
    };

    this.writeSessionIndex = function() {
        this._writeEventsIndex();
        this._writeJournalIndex();
        const sessionIndex = {
            version: 1,
            startUs: this._sessionStartUs,
            endUs: this._lastEventUs,
            segmentDurationUs: SEGMENT_DURATION_US,
            retention: { maxSegments: DEFAULT_RETENTION_MAX_SEGMENTS },
            segments: this._segments.map((segment) => ({ ...segment })),
            eventsIndex: this._getEventsIndexPointer(),
            journalIndex: buildJournalPointer(this._journalTsUs, this._journalTypes),
        };
        writeFileAtomic(`${dir}/session.json`, JSON.stringify(sessionIndex) + '\n');
    };

    this.writeSnapshot = function(obj) {
        this._init();
        this._segmentWriter.writeSnapshot(obj);
    };

    this.writeLog = function(jsonString, tsUs) {
        this._init();
        this._updateTimestamps(tsUs);
        this._segmentWriter.writeLog(jsonString, tsUs);
    };

    this.writeEvent = function(jsonString, tsUs) {
        this._init();
        this._updateTimestamps(tsUs);
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
        const segment = this._currentSegment();
        segment.toUs = this._lastEventUs;
        segment.done = true;
        this.writeSessionIndex();
    };
}

export { HistorySessionWriter };
