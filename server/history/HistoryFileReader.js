import * as std from 'std';
import * as os from 'os';

const ALLOWED_EXACT_FILES = ['snapshot.json', 'events.jsonl', 'manifest.json', 'logs.jsonl', 'journal_index.json'];
const VALID_SESSION_ID = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;
const VALID_CHUNK_FILE = /^chunks\/chunk_\d{4}\.jsonl$/;
const VALID_LOG_CHUNK_FILE = /^logs\/logs_\d{4}\.jsonl$/;
const VALID_CHECKPOINT_FILE = /^checkpoints\/cp_\d{4}\.json$/;

/**
 * HistoryFileReader - Read-only access to history sessions
 *
 * Security: whitelist of allowed filenames, sessionId must be numeric,
 * all reads scoped to historyDir.
 */
function HistoryFileReader(historyDir) {
    const baseDir = historyDir || 'history';

    /** List available sessions with metadata */
    this.listSessions = function () {
        const sessions = [];
        const [entries, err] = os.readdir(baseDir);
        if (err) return sessions;

        for (const entry of entries) {
            if (!VALID_SESSION_ID.test(entry)) continue;
            const dir = `${baseDir}/${entry}`;
            const hasSnapshot = fileExists(`${dir}/snapshot.json`);
            const hasManifest = fileExists(`${dir}/manifest.json`);
            const hasEvents = fileExists(`${dir}/events.jsonl`);
            if (!hasSnapshot && !hasManifest && !hasEvents) continue;
            const hasCheckpoints = dirHasFiles(`${dir}/checkpoints`, /^cp_\d{4}\.json$/);
            const sizeBytes = hasEvents ? fileSize(`${dir}/events.jsonl`) : 0;
            const isComplete = fileExists(`${dir}/done`);
            sessions.push({ sessionId: entry, hasSnapshot, hasEvents, hasManifest, hasCheckpoints, sizeBytes, isComplete });
        }
        sessions.sort((a, b) => (a.sessionId < b.sessionId ? 1 : a.sessionId > b.sessionId ? -1 : 0));
        return sessions;
    };

    /** Read events in a time range — uses chunks if manifest present, falls back to events.jsonl */
    this.readEventsRange = function (sessionId, fromUs, toUs) {
        const manifestResult = this.readFile(sessionId, 'manifest.json');
        if (manifestResult.ok) {
            return readEventsFromChunks(this, sessionId, manifestResult.content, fromUs, toUs);
        }
        const legacyResult = this.readFile(sessionId, 'events.jsonl');
        if (!legacyResult.ok) return [];
        return parseAndFilterEvents(legacyResult.content, fromUs, toUs);
    };

    /** Read an allowed file from a session */
    this.readFile = function (sessionId, fileName) {
        if (!VALID_SESSION_ID.test(sessionId)) {
            return { ok: false, error: 'session_not_found', detail: `Invalid sessionId: ${sessionId}` };
        }
        const isAllowed = ALLOWED_EXACT_FILES.includes(fileName) || VALID_CHUNK_FILE.test(fileName) || VALID_LOG_CHUNK_FILE.test(fileName) || VALID_CHECKPOINT_FILE.test(fileName);
        if (!isAllowed) {
            return { ok: false, error: 'file_not_allowed', detail: `File not allowed: ${fileName}` };
        }
        const path = `${baseDir}/${sessionId}/${fileName}`;
        const file = std.open(path, 'r');
        if (!file) {
            return { ok: false, error: 'file_not_found', detail: `${fileName} not found in session ${sessionId}` };
        }
        try {
            const content = file.readAsString();
            return { ok: true, content };
        } catch (e) {
            return { ok: false, error: 'read_error', detail: String(e) };
        } finally {
            file.close();
        }
    };
}

function readEventsFromChunks(reader, sessionId, manifestContent, fromUs, toUs) {
    let manifest;
    try {
        manifest = JSON.parse(manifestContent);
    } catch (e) {
        print(`[HistoryFileReader] Failed to parse manifest for session ${sessionId}: ${e}`);
        return [];
    }
    const { startUs, chunkCount, chunkDurationUs } = manifest;
    const fromChunk = fromUs !== undefined
        ? Math.max(0, Math.floor((fromUs - startUs) / chunkDurationUs))
        : 0;
    const toChunk = toUs !== undefined
        ? Math.min(chunkCount - 1, Math.floor((toUs - startUs) / chunkDurationUs))
        : chunkCount - 1;
    let events = [];
    for (let i = fromChunk; i <= toChunk; i++) {
        const file = `chunks/chunk_${String(i).padStart(4, '0')}.jsonl`;
        const chunkResult = reader.readFile(sessionId, file);
        if (!chunkResult.ok) continue;
        events = events.concat(parseAndFilterEvents(chunkResult.content, fromUs, toUs));
    }
    return events;
}

function parseAndFilterEvents(content, fromUs, toUs) {
    return content.split('\n')
        .filter(line => line.trim())
        .map(line => { try { return JSON.parse(line); } catch (_e) { return null; } })
        .filter(event => event !== null)
        .filter(event =>
            (fromUs === undefined || event.ts_us >= fromUs) &&
            (toUs === undefined || event.ts_us <= toUs)
        );
}

function fileExists(path) {
    const file = std.open(path, 'r');
    if (!file) return false;
    file.close();
    return true;
}

function fileSize(path) {
    const [stat, err] = os.stat(path);
    if (err) return 0;
    return stat.size || 0;
}

function dirHasFiles(dir, pattern) {
    const [entries, err] = os.readdir(dir);
    if (err) return false;
    return entries.some(entry => pattern.test(entry));
}

export { HistoryFileReader };
