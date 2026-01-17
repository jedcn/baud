import { EventEmitter } from 'events';
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
}
