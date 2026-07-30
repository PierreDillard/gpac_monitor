import { MessageFormatter } from './formatters/messageFormatters';
import WsParserWorker from './workers/wsParserWorker?worker&inline';
import { GpacTransport, TransportMessageHandler } from './GpacTransport';

interface WorkerResponse {
  id: number;
  handlerKey: string;
  parsedData: unknown;
  error?: string;
}

export class WebSocketBase implements GpacTransport {
  private socket: WebSocket | null = null;
  private messageHandlers: {
    [key: string]: TransportMessageHandler[];
  } = {};
  private parserWorker: Worker | null = null;
  private messageId = 0;

  constructor() {
    this.initParserWorker();
  }

  private initParserWorker(): void {
    try {
      this.parserWorker = new WsParserWorker({ name: 'wsParserWorker' });

      this.parserWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { handlerKey, parsedData, error } = event.data;

        if (error) {
          console.error('[WebSocket Worker] Parse error:', error);
        }

        // Convert parsed data back to DataView for handler compatibility
        const dataView = MessageFormatter.createDataView(parsedData);
        this.callMessageHandlers(handlerKey, dataView);
      };

      this.parserWorker.onerror = (error) => {
        console.error('[WebSocket Worker] Error:', error);
        // Worker failed, will fallback to inline parsing
        this.parserWorker = null;
      };
    } catch (error) {
      console.warn('[WebSocket] Worker not available, using inline parsing');
      this.parserWorker = null;
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public connect(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if already connected to avoid multiple connections
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }

        // Check if connection is in progress
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          // Wait for existing connection to complete
          const onOpen = () => {
            this.socket?.removeEventListener('open', onOpen);
            this.socket?.removeEventListener('error', onError);
            resolve();
          };
          const onError = (error: Event) => {
            this.socket?.removeEventListener('open', onOpen);
            this.socket?.removeEventListener('error', onError);
            reject(error);
          };
          this.socket.addEventListener('open', onOpen);
          this.socket.addEventListener('error', onError);
          return;
        }

        if (this.socket) {
          this.socket.close();
          this.socket = null;
        }

        this.socket = new WebSocket(address);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          this.callMessageHandlers(
            '__OnConnect__',
            new DataView(new ArrayBuffer(0)),
          );
          resolve();
        };

        this.socket.onmessage = (event: MessageEvent) => {
          // Use Worker if available (offloads heavy parsing)
          if (this.parserWorker) {
            const id = ++this.messageId;
            this.parserWorker.postMessage({ id, data: event.data });
            return;
          }

          // Fallback: inline parsing (blocks Main Thread)
          this.parseMessageInline(event.data);
        };

        this.socket.onclose = (_event) => {
          this.socket = null;
          this.callMessageHandlers(
            '__OnDisconnect__',
            new DataView(new ArrayBuffer(0)),
          );
        };

        this.socket.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      try {
        this.socket.close(1000, 'Client disconnecting');
      } catch (error) {
        console.error('[WebSocket] Error during disconnect:', error);
      }
      this.socket = null;
    }
  }

  private parseMessageInline(eventData: ArrayBuffer | string): void {
    try {
      let data: string;

      if (eventData instanceof ArrayBuffer) {
        const dataView = new DataView(eventData);
        data = MessageFormatter.decodeDataView(dataView);
      } else {
        data = eventData;
      }

      if (data.startsWith('json:') || data.startsWith('{')) {
        const parsedData = MessageFormatter.parseReceived(data);
        const dataView = MessageFormatter.createDataView(parsedData);
        const handlerKey = data.startsWith('json:') ? 'json:' : 'json';
        this.callMessageHandlers(handlerKey, dataView);
        return;
      }

      const dataView = new DataView(
        eventData instanceof ArrayBuffer
          ? eventData
          : new TextEncoder().encode(data).buffer,
      );

      if (dataView.byteLength >= 4) {
        const id = String.fromCharCode(
          dataView.getInt8(0),
          dataView.getInt8(1),
          dataView.getInt8(2),
          dataView.getInt8(3),
        );

        const handlers = this.messageHandlers[id];
        if (handlers && handlers.length > 0) {
          handlers.forEach((handler) => handler(this, dataView));
          return;
        }
      }

      this.callMessageHandlers('__default__', dataView);
    } catch {
      const errorDataView =
        eventData instanceof ArrayBuffer
          ? new DataView(eventData)
          : new DataView(new TextEncoder().encode(String(eventData)).buffer);
      this.callMessageHandlers('__default__', errorDataView);
    }
  }

  public send(message: string): void {
    if (!this.socket || !this.isConnected()) {
      throw new Error('Cannot send message: WebSocket is not connected');
    }

    try {
      const formattedMessage = MessageFormatter.formatForSend(message);
      this.socket.send(formattedMessage);
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error);
      throw error;
    }
  }

  public addConnectHandler(handler: TransportMessageHandler): void {
    this.addMessageHandler('__OnConnect__', handler);
  }

  public addDisconnectHandler(handler: TransportMessageHandler): void {
    this.addMessageHandler('__OnDisconnect__', handler);
  }

  public addDefaultMessageHandler(handler: TransportMessageHandler): void {
    this.addMessageHandler('__default__', handler);
  }

  public addJsonMessageHandler(handler: TransportMessageHandler): void {
    this.addMessageHandler('json:', handler);
    this.addMessageHandler('json', handler);
  }

  public addMessageHandler(
    messageName: string,
    handler: TransportMessageHandler,
  ): void {
    if (!(messageName in this.messageHandlers)) {
      this.messageHandlers[messageName] = [];
    }
    this.messageHandlers[messageName].push(handler);
  }

  private callMessageHandlers(messageName: string, dataView: DataView): void {
    const handlers = this.messageHandlers[messageName];
    if (!handlers || handlers.length === 0) {
      // If no specific handler and it's not already the default handler,
      // try the default handler
      if (messageName !== '__default__') {
        const defaultHandlers = this.messageHandlers['__default__'];
        if (defaultHandlers) {
          defaultHandlers.forEach((handler) => {
            try {
              handler(this, dataView);
            } catch (error) {
              console.error(`[WebSocket] Error in default handler:`, error);
            }
          });
        }
      }
      return;
    }

    handlers.forEach((handler) => {
      try {
        handler(this, dataView);
      } catch (error) {
        console.error(
          `[WebSocket] Error in handler for ${messageName}:`,
          error,
        );
      }
    });
  }
}
