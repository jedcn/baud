import type { ConnectionManager } from '../connection/ConnectionManager.js';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface OutputLine {
  text: string;
  timestamp: Date;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  protocol: 'telnet' | 'ssh';
  host: string;
  port: number;
  username?: string;
  password?: string;
  privateKey?: string;
}

export interface AppState {
  connection: {
    status: ConnectionStatus;
    currentConnection?: ConnectionManager;
    profile?: ConnectionProfile;
    error?: string;
  };
  output: {
    lines: OutputLine[];
    maxLines: number;
  };
}

export type AppAction =
  | { type: 'CONNECTION_STATUS_CHANGED'; status: ConnectionStatus; error?: string }
  | { type: 'CONNECTION_ESTABLISHED'; connection: ConnectionManager; profile: ConnectionProfile }
  | { type: 'CONNECTION_CLOSED' }
  | { type: 'OUTPUT_LINE_RECEIVED'; line: string }
  | { type: 'CLEAR_OUTPUT' };

export const initialState: AppState = {
  connection: {
    status: 'disconnected',
  },
  output: {
    lines: [],
    maxLines: 1000,
  },
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CONNECTION_STATUS_CHANGED':
      return {
        ...state,
        connection: {
          ...state.connection,
          status: action.status,
          error: action.error,
        },
      };

    case 'CONNECTION_ESTABLISHED':
      return {
        ...state,
        connection: {
          status: 'connected',
          currentConnection: action.connection,
          profile: action.profile,
        },
      };

    case 'CONNECTION_CLOSED':
      return {
        ...state,
        connection: {
          status: 'disconnected',
        },
      };

    case 'OUTPUT_LINE_RECEIVED': {
      const newLine: OutputLine = {
        text: action.line,
        timestamp: new Date(),
      };

      // Ring buffer: keep only maxLines
      const newLines = [...state.output.lines, newLine];
      if (newLines.length > state.output.maxLines) {
        newLines.shift();
      }

      return {
        ...state,
        output: {
          ...state.output,
          lines: newLines,
        },
      };
    }

    case 'CLEAR_OUTPUT':
      return {
        ...state,
        output: {
          ...state.output,
          lines: [],
        },
      };

    default:
      return state;
  }
}
