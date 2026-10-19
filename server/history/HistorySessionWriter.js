import * as os from 'os';
import { HistoryWriter, writeFileAtomic, formatSessionId } from './HistoryWriter.js';
import { AppendIndex } from './helpers/AppendIndex.js';
import {
    SEGMENT_DURATION_US,
    DEFAULT_RETENTION_MAX_SEGMENTS,
    HISTORY_RETENTION_UNLIMITED,
} from '../config/history.config.js';

function removeAllInDir(subDir) {
    const [entries, err] = os.readdir(subDir);
    if (err) return;
    for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        os.remove(`${subDir}/${entry}`);
    }
}

function removeSegmentDir(sessionDir, segmentDir) {
    const dir = `${sessionDir}/${segmentDir}`;
    removeAllInDir(`${dir}/chunks`);
    removeAllInDir(`${dir}/logs`);
    removeAllInDir(`${dir}/checkpoints`);
    os.remove(`${dir}/chunks`);
    os.remove(`${dir}/logs`);
    os.remove(`${dir}/checkpoints`);
    os.remove(`${dir}/manifest.json`);
    os.remove(`${dir}/snapshot.json`);
    os.remove(`${dir}/done`);
    os.remove(dir);
}

/**
 * HistorySessionWriter - root orchestrator: owns session.json and the append-only events_index.jsonl/journal_index.jsonl,
 * delegates chunk/log/checkpoint writes to the current segment's HistoryWriter, handles rollover/retention.
 * @param {string} historyDir
 * @param {string} [sessionId]
 * @param {{ retentionMaxSegments?: number, buildSegmentSnapshot?: (rolloverTsUs: number) => object|undefined }} [options]
 */
function HistorySessionWriter(historyDir, sessionId, options) {
    const baseDir = historyDir || 'history';
    const id = sessionId || formatSessionId(new Date());
    const dir = `${baseDir}/${id}`;
    const segmentsDir = `${dir}/segments`;
    const retentionMaxSegments = (options && options.retentionMaxSegments !== undefined)
        ? options.retentionMaxSegments
        : DEFAULT_RETENTION_MAX_SEGMENTS;
    const buildSegmentSnapshot = options && options.buildSegmentSnapshot;

    this.sessionId = id;
    this.sessionDir = dir;

    this._initialized = false;
    this._segmentWriter = null;
    this._segments = [];
    this._sessionStartUs = null;
    this._lastEventUs = null;
    this._closed = false;
    this._sessionJsonWritten = false;
    this._eventsIndex = new AppendIndex(`${dir}/events_index.jsonl`);
    this._journalIndex = new AppendIndex(`${dir}/journal_index.jsonl`);

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

    this._checkRollover = function(tsUs) {
        const segment = this._currentSegment();
        if (segment.fromUs !== null && tsUs - segment.fromUs >= SEGMENT_DURATION_US) {
            this._rollover(tsUs);
        }
    };

    this._rollover = function(tsUs) {
        const segment = this._currentSegment();
        this._segmentWriter.close();
        segment.toUs = tsUs;
        segment.done = true;

        const nextIndex = segment.index + 1;
        const padded = String(nextIndex).padStart(4, '0');
        this._segmentWriter = new HistoryWriter(segmentsDir, padded);
        this._segments.push({ index: nextIndex, dir: `segments/${padded}`, fromUs: tsUs, toUs: null, pinned: false, done: false });

        if (buildSegmentSnapshot) {
            const snapshot = buildSegmentSnapshot(tsUs);
            if (snapshot) this._segmentWriter.writeSnapshot(snapshot);
        }

        this._purgeRetention();
        this.writeSessionIndex();
    };

    this._purgeRetention = function() {
        if (retentionMaxSegments === HISTORY_RETENTION_UNLIMITED) return;
        while (this._segments.filter((segment) => !segment.pinned).length > retentionMaxSegments) {
            const targetIndex = this._segments.findIndex((segment) => !segment.pinned);
            if (targetIndex === -1) break;
            const [target] = this._segments.splice(targetIndex, 1);
            removeSegmentDir(dir, target.dir);
        }
    };

    this.writeSessionIndex = function() {
        this._writeSessionJson();
    };

    this._flushIndexes = function() {
        this._eventsIndex.flush();
        this._journalIndex.flush();
    };

    this._writeSessionJson = function() {
        const lastIndex = this._segments.length - 1;
        const sessionIndex = {
            version: 1,
            startUs: this._sessionStartUs,
            segmentDurationUs: SEGMENT_DURATION_US,
            retentionMaxSegments: retentionMaxSegments,
            segments: this._segments.map((segment, index) => {
                const entry = { index: segment.index, fromUs: segment.fromUs };
                if (this._closed && index === lastIndex) entry.toUs = segment.toUs;
                return entry;
            }),
        };
        if (this._closed) sessionIndex.endUs = this._lastEventUs;
        writeFileAtomic(`${dir}/session.json`, JSON.stringify(sessionIndex) + '\n');
        this._sessionJsonWritten = true;
    };

    // Torn-session safety: a killed GPAC never reaches close(), so session.json
    // must exist from the first event. Its content only changes at rollover/close,
    // which rewrite it themselves.
    this._ensureSessionJson = function() {
        if (!this._sessionJsonWritten) this._writeSessionJson();
    };

    this.writeSnapshot = function(obj) {
        this._init();
        this._segmentWriter.writeSnapshot(obj);
    };

    this.writeLog = function(jsonString, tsUs) {
        this._init();
        this._updateTimestamps(tsUs);
        this._segmentWriter.writeLog(jsonString, tsUs);
        this._checkRollover(tsUs);
        this._ensureSessionJson();
        this._flushIndexes();
    };

    this.writeEvent = function(jsonString, tsUs) {
        this._init();
        this._updateTimestamps(tsUs);
        const rotated = this._segmentWriter.writeEvent(jsonString, tsUs);
        this._checkRollover(tsUs);
        this._ensureSessionJson();
        this._flushIndexes();
        return rotated;
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
        this._init();
        this._eventsIndex.append(metadata ? { ts_us: tsUs, type, ...metadata } : { ts_us: tsUs, type });
    };

    this.recordJournalFact = function(tsUs, type) {
        if (!Number.isFinite(tsUs)) return;
        this._init();
        this._journalIndex.append({ ts_us: tsUs, type });
    };

    this.close = function() {
        this._init();
        this._segmentWriter.close();
        const segment = this._currentSegment();
        segment.toUs = this._lastEventUs;
        segment.done = true;
        this._closed = true;
        this._eventsIndex.close();
        this._journalIndex.close();
        this.writeSessionIndex();
    };
}

export { HistorySessionWriter };
