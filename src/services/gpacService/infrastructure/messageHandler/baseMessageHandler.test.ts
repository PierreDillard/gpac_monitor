import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseMessageHandler } from './baseMessageHandler';
import { MessageHandlerCallbacks, MessageHandlerDependencies } from './types';
import { GpacNotificationHandlers } from '../../types';
import { EXPECTED_WS_PROTOCOL_VERSION } from '@/services/ws/protocolVersion';
import type { MonitorConfigMessage } from '@/services/ws/types';
import monitorConfigFixture from '@/services/ws/__tests__/fixtures/monitor_config.json';

const typedMonitorConfigFixture: MonitorConfigMessage = {
  ...monitorConfigFixture,
  message: 'monitor_config',
};

function createMockCallbacks(): MessageHandlerCallbacks {
  return {
    onUpdateGraphData: vi.fn(),
    onSetLoading: vi.fn(),
    onUpdateSessionStats: vi.fn(),
    onLogsUpdate: vi.fn(),
    onLogSubscriptionChange: vi.fn(),
    onPidReconfigured: vi.fn(),
    onArgUpdated: vi.fn(),
    onSetMetricDefinitions: vi.fn(),
    onFilterStatuses: vi.fn(),
    onSetMonitorConfig: vi.fn(),
  };
}

function createMockDependencies(): MessageHandlerDependencies {
  return {
    isConnected: vi.fn(() => true),
    send: vi.fn(),
    stopReconnection: vi.fn(),
    markEndOfSession: vi.fn(),
  };
}

function createNotificationHandlers(): GpacNotificationHandlers {
  return {
    onError: vi.fn(),
    onFilterUpdate: vi.fn(),
    onConnectionStatus: vi.fn(),
    onBackendNotification: vi.fn(),
    onProtocolVersionMismatch: vi.fn(),
  };
}

function createHandler(
  callbacks: MessageHandlerCallbacks,
  notificationHandlers: GpacNotificationHandlers = createNotificationHandlers(),
) {
  return new BaseMessageHandler(
    notificationHandlers,
    callbacks,
    createMockDependencies(),
  );
}

function simulateMessage(handler: BaseMessageHandler, data: any) {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(json);
  const dataView = new DataView(buffer.buffer);
  handler.handleDefaultMessage({} as any, dataView);
}

describe('BaseMessageHandler', () => {
  let callbacks: MessageHandlerCallbacks;
  let handler: BaseMessageHandler;

  beforeEach(() => {
    callbacks = createMockCallbacks();
    handler = createHandler(callbacks);
  });

  it('should create message handler instance', () => {
    expect(handler).toBeDefined();
  });

  it('should expose session stats handler', () => {
    expect(handler.getSessionStatsHandler()).toBeDefined();
  });

  it('should expose filter stats handler', () => {
    expect(handler.getFilterStatsHandler()).toBeDefined();
  });

  it('should expose CPU stats handler', () => {
    expect(handler.getCPUStatsHandler()).toBeDefined();
  });

  describe('filter_pid_reconfigured', () => {
    it('should call onPidReconfigured with indexes', () => {
      simulateMessage(handler, {
        message: 'filter_pid_reconfigured',
        indexes: [0, 2, 5],
      });

      expect(callbacks.onPidReconfigured).toHaveBeenCalledWith([0, 2, 5]);
    });

    it('should call onPidReconfigured for single filter', () => {
      simulateMessage(handler, {
        message: 'filter_pid_reconfigured',
        indexes: [3],
      });

      expect(callbacks.onPidReconfigured).toHaveBeenCalledWith([3]);
    });

    it('should not call onArgUpdated on pid reconfigured', () => {
      simulateMessage(handler, {
        message: 'filter_pid_reconfigured',
        indexes: [1],
      });

      expect(callbacks.onArgUpdated).not.toHaveBeenCalled();
    });
  });

  describe('session_metrics', () => {
    it('should call onSetMetricDefinitions with data', () => {
      simulateMessage(handler, {
        message: 'session_metrics',
        data: 'freg=*;done=Done;u=bool\nfreg=rfnalu;NALU=NAL Units',
      });

      expect(callbacks.onSetMetricDefinitions).toHaveBeenCalledWith(
        expect.objectContaining({
          done: expect.any(Object),
          NALU: expect.any(Object),
        }),
      );
    });
  });

  describe('filter_stats → status ingestion', () => {
    it('forwards filter idx and raw status for parsing', () => {
      simulateMessage(handler, {
        message: 'filter_stats',
        idx: 6,
        status: 'seg=7',
      });

      expect(callbacks.onFilterStatuses).toHaveBeenCalledWith([
        { idx: 6, status: 'seg=7' },
      ]);
    });
  });

  describe('session_stats → status ingestion', () => {
    it('forwards every filter idx and raw status for parsing', () => {
      simulateMessage(handler, {
        message: 'session_stats',
        stats: [
          { idx: 6, status: 'seg=7' },
          { idx: 2, status: 'fps=30' },
        ],
      });

      expect(callbacks.onFilterStatuses).toHaveBeenCalledWith([
        { idx: 6, status: 'seg=7' },
        { idx: 2, status: 'fps=30' },
      ]);
    });
  });

  describe('filters → status ingestion', () => {
    it('forwards every filter idx and raw status for parsing', () => {
      simulateMessage(handler, {
        message: 'filters',
        filters: [
          { idx: 6, status: 'seg=7' },
          { idx: 2, status: 'fps=30' },
        ],
      });

      expect(callbacks.onFilterStatuses).toHaveBeenCalledWith([
        { idx: 6, status: 'seg=7' },
        { idx: 2, status: 'fps=30' },
      ]);
    });
  });

  describe('monitor_config → protocol version handshake', () => {
    it('stores intervals and stays silent when versions match', () => {
      const notificationHandlers = createNotificationHandlers();
      const handlerWithNotifications = createHandler(
        callbacks,
        notificationHandlers,
      );

      expect(typedMonitorConfigFixture.ws_protocol_version).toBe(
        EXPECTED_WS_PROTOCOL_VERSION,
      );

      simulateMessage(handlerWithNotifications, typedMonitorConfigFixture);

      expect(callbacks.onSetMonitorConfig).toHaveBeenCalledWith(
        typedMonitorConfigFixture.intervals,
      );
      expect(
        notificationHandlers.onProtocolVersionMismatch,
      ).not.toHaveBeenCalled();
    });

    it('reports server_too_old when the field is absent (server.js predates the handshake)', () => {
      const notificationHandlers = createNotificationHandlers();
      const handlerWithNotifications = createHandler(
        callbacks,
        notificationHandlers,
      );

      simulateMessage(handlerWithNotifications, {
        message: 'monitor_config',
        intervals: { SESSION_STATS: 1000, FILTER_STATS: 1000, CPU_STATS: 500 },
      });

      expect(
        notificationHandlers.onProtocolVersionMismatch,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'server_too_old',
          receivedVersion: undefined,
        }),
      );
    });

    it('reports server_too_old when the server version is lower', () => {
      const notificationHandlers = createNotificationHandlers();
      const handlerWithNotifications = createHandler(
        callbacks,
        notificationHandlers,
      );

      simulateMessage(handlerWithNotifications, {
        message: 'monitor_config',
        intervals: { SESSION_STATS: 1000, FILTER_STATS: 1000, CPU_STATS: 500 },
        ws_protocol_version: EXPECTED_WS_PROTOCOL_VERSION - 1,
        gpac_version: '26.01-DEV-rev1',
      });

      expect(
        notificationHandlers.onProtocolVersionMismatch,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'server_too_old',
          receivedVersion: EXPECTED_WS_PROTOCOL_VERSION - 1,
        }),
      );
    });

    it('reports page_out_of_date when the server version is higher', () => {
      const notificationHandlers = createNotificationHandlers();
      const handlerWithNotifications = createHandler(
        callbacks,
        notificationHandlers,
      );

      simulateMessage(handlerWithNotifications, {
        message: 'monitor_config',
        intervals: { SESSION_STATS: 1000, FILTER_STATS: 1000, CPU_STATS: 500 },
        ws_protocol_version: EXPECTED_WS_PROTOCOL_VERSION + 1,
        gpac_version: '27.01-DEV-rev1',
      });

      expect(
        notificationHandlers.onProtocolVersionMismatch,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'page_out_of_date',
          receivedVersion: EXPECTED_WS_PROTOCOL_VERSION + 1,
        }),
      );
    });
  });

  describe('unknown message type', () => {
    it('warns without throwing when the server sends a message type the front does not know yet', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() =>
        simulateMessage(handler, { message: 'future_message_type' }),
      ).not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('future_message_type'),
      );

      warnSpy.mockRestore();
    });
  });

  describe('setNotificationHandlers called after construction', () => {
    it('wires notification handlers registered post-construction, not just at construction time', () => {
      const handlerWithLateNotifications = createHandler(callbacks, {});
      const notificationHandlers = createNotificationHandlers();

      handlerWithLateNotifications.setNotificationHandlers(
        notificationHandlers,
      );

      simulateMessage(handlerWithLateNotifications, {
        message: 'monitor_config',
        intervals: { SESSION_STATS: 1000, FILTER_STATS: 1000, CPU_STATS: 500 },
      });

      expect(
        notificationHandlers.onProtocolVersionMismatch,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'server_too_old' }),
      );
    });
  });

  describe('filter_arg_updated', () => {
    it('should call onArgUpdated with indexes', () => {
      simulateMessage(handler, {
        message: 'filter_arg_updated',
        indexes: [1, 4],
      });

      expect(callbacks.onArgUpdated).toHaveBeenCalledWith([1, 4]);
    });

    it('should call onArgUpdated for single filter', () => {
      simulateMessage(handler, {
        message: 'filter_arg_updated',
        indexes: [7],
      });

      expect(callbacks.onArgUpdated).toHaveBeenCalledWith([7]);
    });

    it('should not call onPidReconfigured on arg updated', () => {
      simulateMessage(handler, {
        message: 'filter_arg_updated',
        indexes: [2],
      });

      expect(callbacks.onPidReconfigured).not.toHaveBeenCalled();
    });
  });
});
