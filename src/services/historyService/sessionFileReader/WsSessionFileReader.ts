import type {
  HistorySnapshot,
  HistoryEvent,
  LogEvent,
  JournalIndex,
} from '../types';
import type { HistoryManifest } from '../source/types';
import type { SessionInfo } from './types';
import { parseEventsJsonl } from '../loader/eventLoader';
import { parseManifest } from '../manifestParser';
import { parseJournalIndex } from '../journalIndexParser';

/**
 * WsSessionFileReader — reads history sessions from a remote GPAC server over WebSocket.
 * Opens its own dedicated WS connection (separate from the live monitoring socket).
 * Delegates all file I/O to HistoryFileReader.js on the server via list_sessions/read_file commands.
 * Same interface as LocalFileSessionFileReader so ChunkLoader works with either.
 */
export class WsSessionFileReader {
  private ws: WebSocket | null = null;
  private pending = new Map<
    string,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (reason: unknown) => void;
    }
  >();

  constructor(private address: string) {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.address);
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onclose = () => {
        this.ws = null;
        for (const { reject } of this.pending.values()) {
          reject(new Error('WebSocket closed'));
        }
        this.pending.clear();
      };
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  async listSessions(): Promise<SessionInfo[]> {
    await this.ensureConnected();
    const response = await this.sendCommand({ message: 'list_sessions' });
    return response.sessions as SessionInfo[];
  }

  async readSnapshot(sessionId: string): Promise<HistorySnapshot> {
    await this.ensureConnected();
    const response = await this.sendCommand({
      message: 'read_file',
      sessionId,
      file: 'snapshot.json',
    });
    return JSON.parse(response.content as string) as HistorySnapshot;
  }

  async readManifest(sessionId: string): Promise<HistoryManifest | null> {
    await this.ensureConnected();
    try {
      const response = await this.sendCommand({
        message: 'read_file',
        sessionId,
        file: 'manifest.json',
      });
      return parseManifest(JSON.parse(response.content as string));
    } catch {
      return null;
    }
  }

  async readJournalIndex(sessionId: string): Promise<JournalIndex | null> {
    await this.ensureConnected();
    try {
      const response = await this.sendCommand({
        message: 'read_file',
        sessionId,
        file: 'journal_index.json',
      });
      return parseJournalIndex(JSON.parse(response.content as string));
    } catch {
      return null;
    }
  }

  async readCheckpoint(
    sessionId: string,
    chunkIndex: number,
  ): Promise<unknown> {
    await this.ensureConnected();
    const file = `checkpoints/cp_${String(chunkIndex).padStart(4, '0')}.json`;
    try {
      const response = await this.sendCommand({
        message: 'read_file',
        sessionId,
        file,
      });
      return JSON.parse(response.content as string);
    } catch {
      return null;
    }
  }

  async readChunk(
    sessionId: string,
    chunkIndex: number,
  ): Promise<HistoryEvent[]> {
    await this.ensureConnected();
    const file = `chunks/chunk_${String(chunkIndex).padStart(4, '0')}.jsonl`;
    try {
      const response = await this.sendCommand({
        message: 'read_file',
        sessionId,
        file,
      });
      return parseEventsJsonl(response.content as string);
    } catch {
      return [];
    }
  }

  async readLogChunk(
    sessionId: string,
    chunkIndex: number,
  ): Promise<LogEvent[]> {
    await this.ensureConnected();
    const file = `logs/logs_${String(chunkIndex).padStart(4, '0')}.jsonl`;
    try {
      const response = await this.sendCommand({
        message: 'read_file',
        sessionId,
        file,
      });
      return parseEventsJsonl(
        response.content as string,
      ) as unknown as LogEvent[];
    } catch {
      return [];
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
  }

  private sendCommand(
    command: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WsSessionFileReader: not connected'));
        return;
      }
      const key = this.commandKey(command);
      this.pending.set(key, { resolve, reject });
      this.ws.send(`json:${JSON.stringify(command)}`);
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const raw =
        event.data instanceof ArrayBuffer
          ? new TextDecoder().decode(event.data)
          : (event.data as string);
      const data = JSON.parse(raw);
      const key = this.responseKey(data);
      const entry = this.pending.get(key);
      if (!entry) return;
      this.pending.delete(key);

      if (data.status === 'error') {
        entry.reject(new Error(data.detail || data.error));
      } else {
        entry.resolve(data);
      }
    } catch (e) {
      console.warn('[WsSessionFileReader] Unparseable message', e, event.data);
    }
  }

  /** Unique key per request — composite for read_file to avoid collision */
  private commandKey(cmd: Record<string, unknown>): string {
    if (cmd.message === 'read_file')
      return `read_file:${cmd.sessionId}:${cmd.file}`;
    return cmd.message as string;
  }

  /** Maps server response command to the matching pending key */
  private responseKey(data: Record<string, unknown>): string {
    if (data.command === 'read_file')
      return `read_file:${data.sessionId}:${data.file}`;
    return data.command as string;
  }
}
