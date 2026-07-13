import { EventEmitter } from 'node:events';
import type { ConnectionProfile, ConnectionStatus } from '../state/AppState.js';

export abstract class ConnectionManager extends EventEmitter {
  protected profile?: ConnectionProfile;

  abstract connect(profile: ConnectionProfile): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(data: string): void;
  abstract isConnected(): boolean;

  protected emitData(data: string) {
    this.emit('data', data);
  }

  protected emitStatus(status: ConnectionStatus, error?: string) {
    this.emit('status', status, error);
  }

  protected emitError(error: Error) {
    this.emit('error', error);
  }

  /** Inbound silence has crossed the warning threshold but is not yet fatal. */
  protected emitIdleWarning(idleMs: number) {
    this.emit('idle-warning', idleMs);
  }

  /** Inbound silence has crossed the dead threshold; connection presumed lost. */
  protected emitStalled(reason: string) {
    this.emit('stalled', reason);
  }
}
