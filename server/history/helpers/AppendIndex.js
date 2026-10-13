import * as std from 'std';

function AppendIndex(path) {
    this._path = path;
    this._file = null;
    this._failed = false;
    this._pending = false;

    this.append = function(entry) {
        if (!this._file && !this._failed) {
            this._file = std.open(this._path, 'a');
            if (!this._file) {
                this._failed = true;
                print(`[AppendIndex] Failed to open ${this._path}`);
            }
        }
        if (!this._file) return;
        this._file.puts(JSON.stringify(entry) + '\n');
        this._pending = true;
    };

    this.flush = function() {
        if (!this._pending) return;
        this._file.flush();
        this._pending = false;
    };

    this.close = function() {
        if (!this._file) return;
        this._file.close();
        this._file = null;
        this._pending = false;
    };
}

export { AppendIndex };
