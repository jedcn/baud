import type { Socket } from 'node:net';
import { Telnet } from 'telnet-client';
import type { SessionDiagnostics } from '../logging/SessionDiagnostics.js';
import type { SessionLogger } from '../logging/SessionLogger.js';
import type { ConnectionProfile } from '../state/AppState.js';
import { decodeCP437 } from '../utils/cp437.js';
import { ConnectionManager } from './ConnectionManager.js';
import { TelnetProtocol } from './TelnetProtocol.js';

/** How often the OS should send TCP keepalive probes on an idle socket. */
const KEEPALIVE_DELAY_MS = 30_000;

export class TelnetConnection extends ConnectionManager {
  private client: Telnet;
  private connected = false;
  private logger?: SessionLogger;
  private telnet = new TelnetProtocol();
  private diagnostics?: SessionDiagnostics;
  /** Set when the user asks us to disconnect, so the ensuing 'close' event is
   * classified as a normal quit rather than a server/network drop. */
  private userInitiated = false;
  /** Whether a socket error fired during this connection's life. */
  private sawError = false;

  constructor(logger?: SessionLogger, diagnostics?: SessionDiagnostics) {
    super();
    this.client = new Telnet();
    this.logger = logger;
    this.diagnostics = diagnostics;
  }

  async connect(profile: ConnectionProfile): Promise<void> {
    this.profile = profile;
    this.emitStatus('connecting');

    try {
      this.client.on('data', (buffer: Buffer) => {
        if (this.logger) {
          this.logger.logRecv(buffer);
        }
        this.diagnostics?.addBytesReceived(buffer.length);

        // Answer Telnet option negotiation and strip IAC sequences before the
        // bytes are decoded/displayed. Without this the server sees a client
        // that never completes the handshake (and idle-drops it), and the raw
        // IAC bytes render as garbage.
        const { data, response } = this.telnet.receive(buffer);
        if (response.length > 0) {
          this.socket?.write(response);
          this.logger?.logSend(response);
          this.diagnostics?.addBytesSent(response.length);
        }
        if (data.length > 0) {
          this.emitData(decodeCP437(data));
        }
      });

      this.client.on('close', () => {
        this.connected = false;
        // Classify why the socket closed for the end-of-session diagnostics:
        // a close we asked for is a normal quit; a close preceded by an error
        // is a network drop; anything else is the server hanging up cleanly.
        const reason = this.userInitiated
          ? 'user-quit'
          : this.sawError
            ? 'network-error'
            : 'server-closed';
        this.diagnostics?.end(reason);
        this.emitStatus('disconnected');
      });

      this.client.on('error', (error: Error) => {
        this.sawError = true;
        this.diagnostics?.recordError(error.message);
        this.emitStatus('error', error.message);
        this.emitError(error);
      });

      await this.client.connect({
        host: profile.host,
        port: profile.port,
        negotiationMandatory: false,
        timeout: 5000,
        sendTimeout: 0,
      });

      this.connected = true;
      this.diagnostics?.markConnected();

      // Ask the OS to probe idle connections so a half-open socket (server
      // crashed, dead network path, NAT/firewall eviction) eventually surfaces
      // as a real 'error'/'close' instead of blocking on a read forever.
      this.socket?.setKeepAlive(true, KEEPALIVE_DELAY_MS);

      this.emitStatus('connected');
    } catch (error) {
      this.connected = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.diagnostics?.recordError(errorMessage);
      this.diagnostics?.end('connect-failed', errorMessage);
      this.emitStatus('error', errorMessage);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.userInitiated = true;
      await this.client.end();
      this.connected = false;
    }
  }

  send(data: string): void {
    if (this.connected) {
      const payload = `${data}\r\n`;
      if (this.logger) {
        this.logger.logSend(payload);
      }
      this.diagnostics?.addBytesSent(Buffer.byteLength(payload));
      // Write straight to the underlying socket rather than going through
      // telnet-client's `send()`. That method wraps every call in a Promise
      // and attaches a one-shot 'data' listener to capture the command's
      // "response" — but we never consume the Promise (we read all inbound
      // bytes via the persistent 'data' listener installed in connect()), and
      // because we configure `sendTimeout: 0` that per-send listener is only
      // removed when the next inbound 'data' event arrives. A burst of sends
      // with no intervening server output therefore stacks listeners until
      // Node warns "Possible EventTarget memory leak detected. N data
      // listeners added to [Socket]". Writing directly skips that machinery
      // entirely. It also drops the spurious extra `ors` newline that send()
      // appends on top of our own `\r\n`, leaving a clean telnet line.
      this.socket?.write(payload);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // telnet-client keeps the connected net.Socket on a private field; reach it
  // through a narrow cast so we can write outbound bytes ourselves.
  private get socket(): Socket | undefined {
    return (this.client as unknown as { socket: Socket | null }).socket ?? undefined;
  }
}
