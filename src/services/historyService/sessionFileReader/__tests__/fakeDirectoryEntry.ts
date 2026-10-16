/** Path (relative to the dropped folder) → file content. */
export type FakeTree = Record<string, string>;

export function makeMockFile(path: string, content: string): File {
  return {
    webkitRelativePath: path,
    name: path.split('/').pop()!,
    text: () => Promise.resolve(content),
  } as unknown as File;
}

const notFound = () => new DOMException('not found', 'NotFoundError');

/**
 * Fake dropped folder over an in-memory tree. Every directory listed through
 * `readEntries` is pushed to `listedDirs` ('' = the dropped folder itself).
 */
export function fakeDirectoryEntry(
  rootName: string,
  tree: FakeTree,
  listedDirs: string[],
): FileSystemDirectoryEntry {
  const isDir = (path: string) =>
    Object.keys(tree).some((key) => key.startsWith(`${path}/`));

  const fileEntry = (path: string) =>
    ({
      name: path.split('/').pop(),
      isFile: true,
      isDirectory: false,
      file: (success: (file: File) => void) =>
        success(makeMockFile(path, tree[path])),
    }) as unknown as FileSystemFileEntry;

  const childrenOf = (dirPath: string): FileSystemEntry[] => {
    const prefix = dirPath ? `${dirPath}/` : '';
    const names = new Set(
      Object.keys(tree)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length).split('/')[0]),
    );
    return Array.from(names, (name) =>
      prefix + name in tree
        ? fileEntry(prefix + name)
        : dirEntry(prefix + name),
    );
  };

  function dirEntry(dirPath: string): FileSystemDirectoryEntry {
    const full = (path: string) => (dirPath ? `${dirPath}/${path}` : path);
    return {
      name: dirPath ? dirPath.split('/').pop() : rootName,
      isFile: false,
      isDirectory: true,
      getFile: (
        path: string,
        _options: unknown,
        success: (entry: FileSystemEntry) => void,
        error: (err: DOMException) => void,
      ) =>
        full(path) in tree ? success(fileEntry(full(path))) : error(notFound()),
      getDirectory: (
        path: string,
        _options: unknown,
        success: (entry: FileSystemEntry) => void,
        error: (err: DOMException) => void,
      ) =>
        isDir(full(path)) ? success(dirEntry(full(path))) : error(notFound()),
      createReader: () => {
        let consumed = false;
        return {
          readEntries: (success: (entries: FileSystemEntry[]) => void) => {
            listedDirs.push(dirPath);
            success(consumed ? [] : childrenOf(dirPath));
            consumed = true;
          },
        };
      },
    } as unknown as FileSystemDirectoryEntry;
  }

  return dirEntry('');
}
