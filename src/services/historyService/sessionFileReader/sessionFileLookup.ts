/**
 * Resolves a session-relative path to a File, either from a FileList
 * (<input webkitdirectory>) or lazily from a dropped directory entry.
 */
export interface SessionFileLookup {
  sessionIds(): Promise<string[]>;
  file(sessionId: string, path: string): Promise<File | undefined>;
  /** True when `path` exists in the session, as a file or a directory. */
  has(sessionId: string, path: string): Promise<boolean>;
}

const SESSION_ROOT_ENTRIES = new Set(
  `snapshot.json manifest.json journal_index.json session.json
   events_index.json events.jsonl done chunks logs checkpoints segments`.split(
    /\s+/,
  ),
);

const SESSION_MARKER_FILES = [
  'session.json',
  'snapshot.json',
  'manifest.json',
  'events.jsonl',
  'done',
];

const ABSENT_ERRORS = new Set(['NotFoundError', 'TypeMismatchError']);

export function fileListLookup(files: File[]): SessionFileLookup {
  const sessionMap = new Map<string, Map<string, File>>();
  for (const file of files) {
    const parts = file.webkitRelativePath.split('/');
    const rootIndex = parts.findIndex((part) => SESSION_ROOT_ENTRIES.has(part));
    if (rootIndex < 1) continue;

    const sessionId = parts[rootIndex - 1];
    if (!sessionMap.has(sessionId)) sessionMap.set(sessionId, new Map());
    sessionMap.get(sessionId)!.set(parts.slice(rootIndex).join('/'), file);
  }

  return {
    sessionIds: async () => Array.from(sessionMap.keys()),
    file: async (sessionId, path) => sessionMap.get(sessionId)?.get(path),
    has: async (sessionId, path) => {
      const sessionFiles = sessionMap.get(sessionId);
      if (!sessionFiles) return false;
      if (sessionFiles.has(path)) return true;
      for (const key of sessionFiles.keys())
        if (key.startsWith(`${path}/`)) return true;
      return false;
    },
  };
}

const isFileEntry = (entry: FileSystemEntry): entry is FileSystemFileEntry =>
  entry.isFile;

const isDirectoryEntry = (
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntry => entry.isDirectory;

/** Child entry at `path`, or null when absent or of the other kind. */
const getChild = (
  dir: FileSystemDirectoryEntry,
  path: string,
  kind: 'file' | 'directory',
) =>
  new Promise<FileSystemEntry | null>((resolve, reject) => {
    const onError = (error: DOMException) =>
      ABSENT_ERRORS.has(error.name) ? resolve(null) : reject(error);
    if (kind === 'file') dir.getFile(path, {}, resolve, onError);
    else dir.getDirectory(path, {}, resolve, onError);
  });

/** All children of `dir`; readEntries returns batches until an empty one. */
const readChildren = async (dir: FileSystemDirectoryEntry) => {
  const reader = dir.createReader();
  const children: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return children;
    children.push(...batch);
  }
};

const isSessionDir = async (dir: FileSystemDirectoryEntry) =>
  (
    await Promise.all(
      SESSION_MARKER_FILES.map((name) => getChild(dir, name, 'file')),
    )
  ).some((entry) => entry !== null);

/** The dropped folder is a session, or a parent listed one level deep. */
async function findSessionDirs(root: FileSystemDirectoryEntry) {
  if (await isSessionDir(root)) return new Map([[root.name, root]]);
  const subdirs = (await readChildren(root)).filter(isDirectoryEntry);
  const isSession = await Promise.all(subdirs.map(isSessionDir));
  return new Map(
    subdirs
      .filter((_dir, position) => isSession[position])
      .map((dir) => [dir.name, dir]),
  );
}

export function directoryEntryLookup(
  root: FileSystemDirectoryEntry,
): SessionFileLookup {
  let sessionDirs: Promise<Map<string, FileSystemDirectoryEntry>> | null = null;
  const sessionDir = async (sessionId: string) =>
    (await (sessionDirs ??= findSessionDirs(root))).get(sessionId);

  return {
    sessionIds: async () =>
      Array.from((await (sessionDirs ??= findSessionDirs(root))).keys()),
    file: async (sessionId, path) => {
      const dir = await sessionDir(sessionId);
      const entry = dir ? await getChild(dir, path, 'file') : null;
      if (!entry || !isFileEntry(entry)) return undefined;
      return new Promise<File>((resolve, reject) =>
        entry.file(resolve, reject),
      );
    },
    has: async (sessionId, path) => {
      const dir = await sessionDir(sessionId);
      if (!dir) return false;
      return (
        (await getChild(dir, path, 'file')) !== null ||
        (await getChild(dir, path, 'directory')) !== null
      );
    },
  };
}
