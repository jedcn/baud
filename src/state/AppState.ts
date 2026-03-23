import type { ConnectionManager } from '../connection/ConnectionManager.js';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TextSegment {
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface OutputLine {
  text: string; // Plain text (ANSI codes stripped)
  segments: TextSegment[]; // Styled text segments
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

export interface StatusSegment {
  text: string;
  fg?: string;
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
  statusSegments: StatusSegment[];
}

export type AppAction =
  | { type: 'CONNECTION_STATUS_CHANGED'; status: ConnectionStatus; error?: string }
  | { type: 'CONNECTION_ESTABLISHED'; connection: ConnectionManager; profile: ConnectionProfile }
  | { type: 'CONNECTION_CLOSED' }
  | { type: 'OUTPUT_LINE_RECEIVED'; line: string; segments: TextSegment[] }
  | { type: 'OUTPUT_LINES_RECEIVED'; lines: Array<{ line: string; segments: TextSegment[] }> }
  | { type: 'CLEAR_OUTPUT' }
  | { type: 'SET_STATUS_SEGMENTS'; segments: StatusSegment[] };

export function makeInitialState(): AppState {
  return {
    connection: {
      status: 'disconnected',
    },
    output: {
      lines: [],
      maxLines: process.stdout.rows ?? 50,
    },
    statusSegments: [],
  };
}

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
        segments: action.segments,
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

    case 'OUTPUT_LINES_RECEIVED': {
      const newLines = [...state.output.lines];
      for (const { line, segments } of action.lines) {
        newLines.push({ text: line, segments, timestamp: new Date() });
      }
      const trimmed =
        newLines.length > state.output.maxLines
          ? newLines.slice(newLines.length - state.output.maxLines)
          : newLines;
      return {
        ...state,
        output: {
          ...state.output,
          lines: trimmed,
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

    case 'SET_STATUS_SEGMENTS':
      return {
        ...state,
        statusSegments: action.segments,
      };

    default:
      return state;
  }
}
