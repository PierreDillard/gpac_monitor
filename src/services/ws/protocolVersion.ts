// Bump on any front<->server CONTRACT change (new message, new field the front relies on,
// changed semantics)
// Counterpart: server/config/live.config.js WS_PROTOCOL_VERSION.
export const EXPECTED_WS_PROTOCOL_VERSION = 1;

export type ProtocolVersionMismatchKind = 'server_too_old' | 'page_out_of_date';

export interface ProtocolVersionMismatch {
  kind: ProtocolVersionMismatchKind;
  expectedVersion: number;
  receivedVersion: number | undefined;
  gpacVersion: string | null | undefined;
}

export function checkProtocolVersionMismatch(
  receivedVersion: number | undefined,
  gpacVersion: string | null | undefined,
): ProtocolVersionMismatch | null {
  if (
    receivedVersion === undefined ||
    receivedVersion < EXPECTED_WS_PROTOCOL_VERSION
  ) {
    return {
      kind: 'server_too_old',
      expectedVersion: EXPECTED_WS_PROTOCOL_VERSION,
      receivedVersion,
      gpacVersion,
    };
  }

  if (receivedVersion > EXPECTED_WS_PROTOCOL_VERSION) {
    return {
      kind: 'page_out_of_date',
      expectedVersion: EXPECTED_WS_PROTOCOL_VERSION,
      receivedVersion,
      gpacVersion,
    };
  }

  return null;
}
