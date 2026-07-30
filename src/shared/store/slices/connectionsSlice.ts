import { createSlice, PayloadAction, isAnyOf } from '@reduxjs/toolkit';
import { createListenerMiddleware } from '@reduxjs/toolkit';
import { GpacConnectionConfig } from '@/types/connection';
import { ConnectionStatus } from '@/types/communication/shared';

const STORAGE_KEY = 'gpac-connections';
const ACTIVE_CONNECTION_KEY = 'gpac-active-connection';

/** Default connection */
const DEFAULT_CONNECTION: GpacConnectionConfig = {
  id: 'default',
  name: 'Default',
  address: 'ws://localhost:6363',
  type: 'local',
  status: ConnectionStatus.DISCONNECTED,
};

/** Convert array to normalized state by ID */
const connectionsArrayToById = (
  connections: GpacConnectionConfig[],
): Record<string, GpacConnectionConfig> => {
  return connections.reduce<Record<string, GpacConnectionConfig>>(
    (acc, conn) => {
      acc[conn.id] = conn;
      return acc;
    },
    {},
  );
};

/** Convert normalized state to array */
const connectionsByIdToArray = (
  connectionsById: Record<string, GpacConnectionConfig>,
): GpacConnectionConfig[] => {
  return Object.values(connectionsById);
};

/** Load connections from localStorage */
const loadConnections = (): Record<string, GpacConnectionConfig> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? connectionsArrayToById(JSON.parse(stored))
      : { [DEFAULT_CONNECTION.id]: DEFAULT_CONNECTION };
  } catch {
    return { [DEFAULT_CONNECTION.id]: DEFAULT_CONNECTION };
  }
};

/** Load active connection ID from localStorage */
const loadActiveConnectionId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_CONNECTION_KEY) || DEFAULT_CONNECTION.id;
  } catch {
    return DEFAULT_CONNECTION.id;
  }
};

/** Save connections to localStorage */
const saveConnections = (
  connectionsById: Record<string, GpacConnectionConfig>,
): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(connectionsByIdToArray(connectionsById)),
    );
  } catch (error) {
    console.error('[connectionsSlice] Save failed:', error);
  }
};

/** Save active connection ID to localStorage */
const saveActiveConnectionId = (id: string | null): void => {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CONNECTION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CONNECTION_KEY);
    }
  } catch (error) {
    console.error('[connectionsSlice] Save active ID failed:', error);
  }
};

interface ConnectionsState {
  connectionsById: Record<string, GpacConnectionConfig>;
  activeConnectionId: string | null;
}

const initialState: ConnectionsState = {
  connectionsById: loadConnections(),
  activeConnectionId: loadActiveConnectionId(),
};

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    addConnection: (state, action: PayloadAction<GpacConnectionConfig>) => {
      state.connectionsById[action.payload.id] = action.payload;
    },

    removeConnection: (state, action: PayloadAction<string>) => {
      delete state.connectionsById[action.payload];
      if (state.activeConnectionId === action.payload) {
        state.activeConnectionId = null;
      }
    },

    updateConnection: (state, action: PayloadAction<GpacConnectionConfig>) => {
      state.connectionsById[action.payload.id] = {
        ...state.connectionsById[action.payload.id],
        ...action.payload,
      };
    },

    setActiveConnection: (state, action: PayloadAction<string | null>) => {
      state.activeConnectionId = action.payload;
    },

    updateConnectionStatus: (
      state,
      action: PayloadAction<{ id: string; status: ConnectionStatus }>,
    ) => {
      const connection = state.connectionsById[action.payload.id];
      if (connection) {
        connection.status = action.payload.status;
      }
    },

    clearConnections: (state) => {
      state.connectionsById = {};
      state.activeConnectionId = null;
    },
  },
});

export const {
  addConnection,
  removeConnection,
  updateConnection,
  setActiveConnection,
  updateConnectionStatus,
  clearConnections,
} = connectionsSlice.actions;

export default connectionsSlice.reducer;

/** Listener middleware for localStorage persistence */
export const connectionsListenerMiddleware = createListenerMiddleware();

connectionsListenerMiddleware.startListening({
  matcher: isAnyOf(
    addConnection,
    updateConnection,
    removeConnection,
    clearConnections,
  ),
  effect: (_, api) => {
    const state = api.getState() as { connections: ConnectionsState };
    saveConnections(state.connections.connectionsById);
  },
});

connectionsListenerMiddleware.startListening({
  actionCreator: setActiveConnection,
  effect: (action) => {
    saveActiveConnectionId(action.payload);
  },
});
