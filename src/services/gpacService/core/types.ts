import { GraphFilterData } from '../../../types/domain/gpac/model';
import { ProtocolVersionMismatch } from '../../ws/protocolVersion';

export interface GpacNotificationHandlers {
  onError?: (error: Error) => void;
  onFilterUpdate?: (filter: GraphFilterData) => void;
  onConnectionStatus?: (connected: boolean) => void;
  onBackendNotification?: (title: string, description: string) => void;
  onProtocolVersionMismatch?: (mismatch: ProtocolVersionMismatch) => void;
}
