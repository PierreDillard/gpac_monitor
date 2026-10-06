// TEMP perf-gate — tâche 29 E1, prototype jetable, jamais commité.
import type { DragEvent } from 'react';

const PROBE_PATHS = ['session.json', 'segments/0003/chunks/chunk_0000.jsonl'];

const isDirectoryEntry = (
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntry => entry.isDirectory;

const isFileEntry = (entry: FileSystemEntry): entry is FileSystemFileEntry =>
  entry.isFile;

const getFile = (directory: FileSystemDirectoryEntry, path: string) =>
  new Promise<File>((resolve, reject) =>
    directory.getFile(
      path,
      {},
      (entry) => {
        if (isFileEntry(entry)) entry.file(resolve, reject);
        else reject(new Error(`${path} is not a file`));
      },
      reject,
    ),
  );

const readProbePaths = async (
  directory: FileSystemDirectoryEntry,
  dropMs: number,
) => {
  for (const path of PROBE_PATHS) {
    const startMs = performance.now();
    try {
      const text = await (await getFile(directory, path)).text();
      const endMs = performance.now();
      console.log(
        `[TEMP perf-gate] ${path}: ${(endMs - startMs).toFixed(1)} ms ` +
          `(drop → fin ${(endMs - dropMs).toFixed(1)} ms, ${text.length} car.)`,
      );
    } catch (error) {
      console.error(`[TEMP perf-gate] ${path}: échec`, error);
    }
  }
};

export const probeDroppedFolder = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  const dropMs = performance.now();
  const entry = event.dataTransfer.items[0]?.webkitGetAsEntry();
  console.log(
    `[TEMP perf-gate] entrée « ${entry?.name} » obtenue en ` +
      `${(performance.now() - dropMs).toFixed(1)} ms`,
  );
  if (!entry || !isDirectoryEntry(entry)) {
    console.error('[TEMP perf-gate] élément déposé : pas un dossier');
    return;
  }
  void readProbePaths(entry, dropMs);
};
