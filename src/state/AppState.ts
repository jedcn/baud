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
  id: number; // Monotonic ID, used as stable key for <Static>
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
  // Render flush against the previous segment instead of after the usual
  // space. Lets a script colour part of a value differently from the rest
  // without breaking it apart visually, e.g. "(184,893)" + a red "^".
  glue?: boolean;
  // Render bold. Colour alone is easy to miss on a bar that is already
  // colourful; bold is what makes a transient segment — an XP delta that
  // shows for a few seconds, say — read as "this just changed".
  bold?: boolean;
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
    nextLineId: number;
    generation: number; // increments on CLEAR_OUTPUT so <Static> remounts with fresh state
  };
  statusSegments: StatusSegment[];
}

export type AppAction =
  | { type: 'CONNECTION_STARTED'; profile: ConnectionProfile }
  | { type: 'CONNECTION_STATUS_CHANGED'; status: ConnectionStatus; error?: string }
  | { type: 'CONNECTION_ESTABLISHED'; connection: ConnectionManager; profile: ConnectionProfile }
  | { type: 'CONNECTION_CLOSED' }
  | { type: 'OUTPUT_LINE_RECEIVED'; line: string; segments: TextSegment[] }
  | { type: 'CLEAR_OUTPUT' }
  | { type: 'SET_STATUS_SEGMENTS'; segments: StatusSegment[] };

export const initialState: AppState = {
  connection: {
    status: 'disconnected',
  },
  output: {
    lines: [],
    nextLineId: 0,
    generation: 0,
  },
  statusSegments: [],
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Record the profile as soon as we start dialling, not just once we're in.
    // Without this the status bar has nothing to name and reads
    // "Connecting to undefined:undefined...".
    case 'CONNECTION_STARTED':
      return {
        ...state,
        connection: {
          status: 'connecting',
          profile: action.profile,
        },
      };

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
        id: state.output.nextLineId,
        text: action.line,
        segments: action.segments,
        timestamp: new Date(),
      };
      return {
        ...state,
        output: {
          ...state.output,
          lines: [...state.output.lines, newLine],
          nextLineId: state.output.nextLineId + 1,
        },
      };
    }

    case 'CLEAR_OUTPUT':
      return {
        ...state,
        output: {
          lines: [],
          nextLineId: 0,
          generation: state.output.generation + 1,
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
