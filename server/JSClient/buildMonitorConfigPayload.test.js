import { describe, it, expect, afterEach } from 'vitest';
import { Sys as sys } from 'gpaccore';
import { buildMonitorConfigPayload } from './buildMonitorConfigPayload.js';
import { UPDATE_INTERVALS, LOG_RETENTION, WS_PROTOCOL_VERSION } from './config.js';
import monitorConfigFixture from '../../src/services/ws/__tests__/fixtures/monitor_config.json';

describe('buildMonitorConfigPayload', () => {
  afterEach(() => {
    delete sys.version_full;
  });

  it('announces intervals, log retention and the protocol version', () => {
    const payload = buildMonitorConfigPayload();

    expect(payload.message).toBe('monitor_config');
    expect(payload.intervals).toEqual(UPDATE_INTERVALS);
    expect(payload.logRetention).toEqual(LOG_RETENTION);
    expect(payload.ws_protocol_version).toBe(WS_PROTOCOL_VERSION);
  });

  it('reads the GPAC version when available', () => {
    sys.version_full = '26.03-DEV-rev3';

    const payload = buildMonitorConfigPayload();

    expect(payload.gpac_version).toBe('26.03-DEV-rev3');
  });

  it('falls back to null without throwing when the binding is missing on an older GPAC binary', () => {
    Object.defineProperty(sys, 'version_full', {
      configurable: true,
      get() {
        throw new Error('version_full not bound on this GPAC binary');
      },
    });

    const payload = buildMonitorConfigPayload();

    expect(payload.gpac_version).toBeNull();
  });

  it('matches the shared monitor_config fixture consumed by the front (src/services/ws/__tests__/fixtures/monitor_config.json)', () => {
    sys.version_full = monitorConfigFixture.gpac_version;

    const payload = buildMonitorConfigPayload();

    expect(payload).toEqual(monitorConfigFixture);
  });

  it('keeps the monitor_config contract shape stable — a diff here means bump WS_PROTOCOL_VERSION on both sides', () => {
    const payload = buildMonitorConfigPayload();

    expect(Object.keys(payload).sort()).toMatchInlineSnapshot(`
      [
        "gpac_version",
        "intervals",
        "logRetention",
        "message",
        "ws_protocol_version",
      ]
    `);
  });
});
