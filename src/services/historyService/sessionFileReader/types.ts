export interface SessionInfo {
  sessionId: string;
  hasSnapshot: boolean;
  hasEvents: boolean;
  hasManifest: boolean;
  hasCheckpoints: boolean;
  sizeBytes?: number;
  isComplete: boolean;
  startUs?: number;
  endUs?: number;
}
