import { describe, it, expect } from 'vitest';
import {
  checkProtocolVersionMismatch,
  EXPECTED_WS_PROTOCOL_VERSION,
} from './protocolVersion';
import { WS_PROTOCOL_VERSION } from '../../../server/config/live.config.js';

describe('WS protocol version constants', () => {
  it('moves in lockstep with the server constant', () => {
    expect(EXPECTED_WS_PROTOCOL_VERSION).toBe(WS_PROTOCOL_VERSION);
  });
});

describe('checkProtocolVersionMismatch', () => {
  it('flags a missing version as server_too_old (server.js predates the handshake)', () => {
    const mismatch = checkProtocolVersionMismatch(undefined, undefined);

    expect(mismatch).toEqual({
      kind: 'server_too_old',
      expectedVersion: EXPECTED_WS_PROTOCOL_VERSION,
      receivedVersion: undefined,
      gpacVersion: undefined,
    });
  });

  it('flags a lower version as server_too_old', () => {
    const mismatch = checkProtocolVersionMismatch(
      EXPECTED_WS_PROTOCOL_VERSION - 1,
      '26.01-DEV-rev1',
    );

    expect(mismatch).toEqual({
      kind: 'server_too_old',
      expectedVersion: EXPECTED_WS_PROTOCOL_VERSION,
      receivedVersion: EXPECTED_WS_PROTOCOL_VERSION - 1,
      gpacVersion: '26.01-DEV-rev1',
    });
  });

  it('flags a higher version as page_out_of_date', () => {
    const mismatch = checkProtocolVersionMismatch(
      EXPECTED_WS_PROTOCOL_VERSION + 1,
      '27.01-DEV-rev1',
    );

    expect(mismatch).toEqual({
      kind: 'page_out_of_date',
      expectedVersion: EXPECTED_WS_PROTOCOL_VERSION,
      receivedVersion: EXPECTED_WS_PROTOCOL_VERSION + 1,
      gpacVersion: '27.01-DEV-rev1',
    });
  });

  it('returns null on equal versions (silent)', () => {
    const mismatch = checkProtocolVersionMismatch(
      EXPECTED_WS_PROTOCOL_VERSION,
      '26.03-DEV-rev3',
    );

    expect(mismatch).toBeNull();
  });
});
