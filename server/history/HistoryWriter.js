import * as std from 'std';
import * as os from 'os';
import { ChunkStream } from './helpers/ChunkStream.js';
import { buildJournalPointer, serializeJournalIndex } from './helpers/journalIndex.js';
import { CHUNK_DURATION_US, MAX_LOG_PER_CHUNK } from '../config/history.config.js';

function writeFileAtomic(path, content) {
    const tmpPath = `${path}.tmp`;
    const tmpFile = std.open(tmpPath, 'w');
    if (!tmpFile) { print(`[HistoryWriter] Failed to write ${tmpPath}`); return; }
    tmpFile.puts(content);
    tmpFile.close();
    const err = os.rename(tmpPath, path);
    if (err !== 0) { print(`[HistoryWriter] Failed to rename ${tmpPath} to ${path} (errno ${err})`); }
}

function HistoryWriter(historyDir, sessionId) {
    const baseDir = historyDir || 'history';
    const id = sessionId || String(Date.now());
    const dir = `${baseDir}/${id}`;
    const chunksDir = `${dir}/chunks`;
    const logsDir = `${dir}/logs`;
    const checkpointsDir = `${dir}/checkpoints`;

    this.sessionId = id;
    this.sessionDir = dir;
    this.snapshotPath = `${dir}/snapshot.json`;

    this._initialized = false;
    this._events = null;
    this._logs = null;
    this._sessionStartUs = null;
    this._lastEventUs = null;
    this._checkpoints = [];
    this._eventsIndex = [];
    this._journalTsUs = [];
    this._journalTypes = [];

    this._init = function() {
        if (this._initialized) return;
        this._initialized = true;
        try { os.mkdir(baseDir); } catch (_e) {}
        try { os.mkdir(dir); } catch (_e) {}
        try { os.mkdir(chunksDir); } catch (_e) {}
        try { os.mkdir(logsDir); } catch (_e) {}
        try { os.mkdir(checkpointsDir); } catch (_e) {}
        print(`[HistoryWriter] Recording session ${id} to ${dir}/`);
        this._events = new ChunkStream(chunksDir, 'chunk', CHUNK_DURATION_US);
        this._logs = new ChunkStream(logsDir, 'logs', CHUNK_DURATION_US, MAX_LOG_PER_CHUNK);
    };

    this._updateTimestamps = function(tsUs) {
        if (this._sessionStartUs === null) this._sessionStartUs = tsUs;
        this._lastEventUs = tsUs;
    };

    this.addEventIndex = function(tsUs, type, metadata) {
        if (!Number.isFinite(tsUs)) return;
        this._eventsIndex.push(metadata ? { ts_us: tsUs, type, ...metadata } : { ts_us: tsUs, type });
    };

    // error/warning facts: columnar (parallel arrays), not an array of objects,
    // so manifest/journal stay cheap to re-serialize even rewritten in full.
    this.recordJournalFact = function(tsUs, type) {
        if (!Number.isFinite(tsUs)) return;
        this._journalTsUs.push(tsUs);
        this._journalTypes.push(type);
    };

    this._writeJournalIndex = function() {
        if (this._journalTsUs.length === 0) return;
        writeFileAtomic(
            `${dir}/journal_index.json`,
            JSON.stringify(serializeJournalIndex(this._journalTsUs, this._journalTypes)) + '\n'
        );
    };

    this._getJournalPointer = function() {
        return buildJournalPointer(this._journalTsUs, this._journalTypes);
    };

    this._writeManifest = function() {
        const manifest = {
            version: 1,
            startUs: this._sessionStartUs,
            endUs: this._lastEventUs,
            chunkDurationUs: CHUNK_DURATION_US,
            chunkCount: this._events ? this._events.getChunkCount() : 1,
            snapshot: 'snapshot.json',
            checkpoints: this._checkpoints,
            logChunks: this._logs ? this._logs.getAllChunks() : [],
            eventsIndex: [...this._eventsIndex].sort((a, b) => a.ts_us - b.ts_us),
            journalIndex: this._getJournalPointer(),
        };
        this._writeJournalIndex();
        writeFileAtomic(`${dir}/manifest.json`, JSON.stringify(manifest) + '\n');
    };

    this.writeSnapshot = function(obj) {
        this._init();
        const snapshotFile = std.open(this.snapshotPath, 'w');
        if (!snapshotFile) { print(`[HistoryWriter] Failed to write snapshot`); return; }
        snapshotFile.puts(JSON.stringify(obj) + '\n');
        snapshotFile.close();
    };

    this.writeLog = function(jsonString, tsUs) {
        this._init();
        this._updateTimestamps(tsUs);
        if (this._logs.write(jsonString, tsUs)) this._writeManifest();
    };

    this.writeEvent = function(jsonString, tsUs) {
        this._init();
        this._updateTimestamps(tsUs);
        const rotated = this._events.write(jsonString, tsUs);
        if (rotated) this._writeManifest();
        return rotated;
    };

    this.writeCheckpoint = function(chunkIndex, obj) {
        const padded = String(chunkIndex).padStart(4, '0');
        const file = `checkpoints/cp_${padded}.json`;
        const cpFile = std.open(`${dir}/${file}`, 'w');
        if (!cpFile) { print(`[HistoryWriter] Failed to write checkpoint ${file}`); return; }
        cpFile.puts(JSON.stringify(obj) + '\n');
        cpFile.close();
        this._checkpoints.push({ chunkIndex, file });
        this._writeManifest();
    };

    this.getCurrentChunkIndex = function() {
        return this._events ? this._events._index : 0;
    };

    this.getCurrentLogChunkIndex = function() {
        return this._logs ? this._logs._index : 0;
    };

    this.close = function() {
        if (this._events) this._events.close();
        if (this._logs) this._logs.close();
        this._writeManifest();
        const doneFile = std.open(`${dir}/done`, 'w');
        if (doneFile) doneFile.close();
    };
}

export { HistoryWriter, writeFileAtomic };
