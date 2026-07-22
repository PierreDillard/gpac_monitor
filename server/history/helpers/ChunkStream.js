import * as std from 'std';

function ChunkStream(dir, prefix, maxDuration, maxCount) {
    this._dir = dir;
    this._prefix = prefix;
    this._maxDuration = maxDuration;
    this._maxCount = maxCount || Infinity;
    this._file = null;
    this._index = 0;
    this._count = 0;
    this._startUs = null;
    this._lastUs = null;
    this._completed = [];

    this._path = function(index) {
        const padded = String(index).padStart(4, '0');
        return `${this._dir}/${this._prefix}_${padded}.jsonl`;
    };

    this._open = function() {
        if (this._file) {
            this._file.close();
            this._file = null;
        }
        const path = this._path(this._index);
        this._file = std.open(path, 'a');
        if (!this._file) {
            print(`[ChunkStream] Failed to open ${path}`);
        }
        this._count = 0;
        this._startUs = null;
    };

    this._finalizeCurrentChunk = function() {
        const dirName = this._dir.split('/').pop();
        return {
            file: `${dirName}/${this._prefix}_${String(this._index).padStart(4, '0')}.jsonl`,
            fromUs: this._startUs,
            toUs: this._lastUs,
            count: this._count,
        };
    };

    this.write = function(line, tsUs) {
        if (!this._file) this._open();
        if (!this._file) return false;
        if (this._startUs === null) this._startUs = tsUs;

        this._file.puts(line + '\n');
        this._count++;
        this._lastUs = tsUs;

        const shouldRotate =
            (tsUs - this._startUs >= this._maxDuration) ||
            (this._count >= this._maxCount);

        if (shouldRotate) {
            this._completed.push(this._finalizeCurrentChunk());
            this._index++;
            this._open();
            return true;
        }

        return false;
    };

    this.getChunkCount = function() {
        return this._index + 1;
    };

    this.getAllChunks = function() {
        return this._completed.slice();
    };

    // Sealed chunks + the open one — for mid-session manifests of torn sessions
    this.getAllChunksIncludingOpen = function() {
        const all = this._completed.slice();
        if (this._file && this._count > 0) all.push(this._finalizeCurrentChunk());
        return all;
    };

    this.close = function() {
        if (this._file) {
            if (this._count > 0) this._completed.push(this._finalizeCurrentChunk());
            this._file.close();
            this._file = null;
        }
    };

    this._open();
}

export { ChunkStream };
