import { GpacTransport } from '../../ws/GpacTransport';
import { store } from '@/shared/store';
import { setLoading, setError } from '@/shared/store/slices/graphSlice';
import { GpacNotificationHandlers } from '../types';

export class ConnectionManager {
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private notificationHandlers: GpacNotificationHandlers = {};
  private address: string | null = null;
  private endOfSession: boolean = false;
  private wasConnected: boolean = false;

  constructor(private ws: GpacTransport) {}

  public setNotificationHandlers(handlers: GpacNotificationHandlers): void {
    this.notificationHandlers = handlers;
  }

  public setAddress(address: string): void {
    this.address = address;
  }

  public getAddress(): string | null {
    return this.address;
  }

  public async connect(address?: string): Promise<void> {
    const targetAddress = address || this.address;

    if (!targetAddress) {
      throw new Error('[ConnectionManager] No address provided');
    }

    if (this.isConnecting) {
      return;
    }

    if (this.ws.isConnected()) {
      return;
    }

    this.address = targetAddress;
    this.isConnecting = true;
    this.endOfSession = false; // Reset flag for new connection
    store.dispatch(setLoading(true));

    try {
      await this.ws.connect(targetAddress);
      this.notificationHandlers.onConnectionStatus?.(true);
      this.onConnectionSuccess();
    } catch (error) {
      this.isConnecting = false;
      store.dispatch(setLoading(false));
      throw error;
    }
  }

  public disconnect(): void {
    this.cleanup();
    this.ws.disconnect();
  }

  public isConnected(): boolean {
    return this.ws.isConnected();
  }

  public handleDisconnect(): void {
    console.log(
      '[ConnectionManager] Connection lost - no automatic reconnection',
    );
    this.cleanup();

    // Only show error if it's NOT a normal end of session
    if (this.wasConnected && !this.endOfSession) {
      store.dispatch(setError('Connection to GPAC server lost'));
    } else {
      store.dispatch(setError(null));
    }

    // Reset flag for next connection
    this.endOfSession = false;
    this.wasConnected = false;
  }

  private onConnectionSuccess(): void {
    this.isConnecting = false;
    this.wasConnected = true;
    store.dispatch(setError(null));
  }

  /** Stop reconnection attempts manually (e.g., when GPAC process is closed) */
  public stopReconnection(): void {
    this.cleanup();
  }

  /** Mark session as ended normally (to avoid showing error on disconnect) */
  public markEndOfSession(): void {
    this.endOfSession = true;
  }

  private cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isConnecting = false;
  }
}
