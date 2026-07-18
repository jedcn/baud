/**
 * Collects facts about a single connection's lifetime and, when the session
 * ends, prints a labelled summary explaining *how* it ended.
 *
 * The audience for that summary is a future Claude helping debug "I keep
 * losing my connection": the report is plain, self-describing text so it can
 * be pasted straight into a chat without any surrounding context.
 */

export type DisconnectReason =
  /** The user ended it — quit the client or called disconnect() themselves. */
  | 'user-quit'
  /** The remote closed the connection cleanly (a FIN with no socket error). */
  | 'server-closed'
  /** A socket error tore it down: reset, timeout, half-open detected, etc. */
  | 'network-error'
  /** We never finished connecting in the first place. */
  | 'connect-failed'
  /** Ended before any reason was recorded (shouldn't normally happen). */
  | 'unknown';

const REASON_HEADLINE: Record<DisconnectReason, string> = {
  'user-quit': 'You ended the session (normal exit).',
  'server-closed': 'The server closed the connection cleanly.',
  'network-error': 'A network error dropped the connection (not a clean close).',
  'connect-failed': 'The connection never got established.',
  unknown: 'The session ended for an unrecorded reason.',
};

const REASON_NOTE: Record<DisconnectReason, string> = {
  'user-quit': 'Nothing to debug here — this is the expected way to leave.',
  'server-closed':
    'The remote sent a clean shutdown. Common if the server timed you out for ' +
    'idleness, restarted, or you were logged out in-game.',
  'network-error':
    'The socket died mid-session — a reset (ECONNRESET), a timeout (ETIMEDOUT), ' +
    'or the TCP keepalive surfacing a half-open connection. Points at the ' +
    'network path or the server dropping off, rather than a graceful logout.',
  'connect-failed':
    'We could not reach the server at all. Check the host/port and that the ' + 'server is up.',
  unknown: 'No lifecycle event set a reason before exit.',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export class SessionDiagnostics {
  private readonly host: string;
  private readonly port: number;
  private readonly startedAt = new Date();
  private connectedAt?: Date;
  private endedAt?: Date;
  private reason: DisconnectReason = 'unknown';
  private detail?: string;
  private lastError?: string;
  private bytesReceived = 0;
  private bytesSent = 0;
  private printed = false;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  /** Record that the socket finished connecting. */
  markConnected(): void {
    if (!this.connectedAt) {
      this.connectedAt = new Date();
    }
  }

  addBytesReceived(count: number): void {
    this.bytesReceived += count;
  }

  addBytesSent(count: number): void {
    this.bytesSent += count;
  }

  /** Note the most recent socket error message (not itself terminal). */
  recordError(message: string): void {
    this.lastError = message;
  }

  /**
   * Mark the session ended. The first terminal reason wins, so an
   * error-then-close sequence keeps the more specific 'network-error' and a
   * later best-effort default (e.g. 'user-quit' on process exit) can't clobber
   * a real reason.
   */
  end(reason: DisconnectReason, detail?: string): void {
    if (this.endedAt) return;
    this.endedAt = new Date();
    this.reason = reason;
    if (detail) this.detail = detail;
  }

  hasEnded(): boolean {
    return this.endedAt !== undefined;
  }

  /** Build the human-readable report block. */
  report(): string {
    const end = this.endedAt ?? new Date();
    const width = 60;
    const rule = '═'.repeat(width);
    const lines: string[] = [];

    lines.push(rule);
    lines.push(`baud session ended — ${this.reason}`);
    lines.push(rule);
    lines.push(`Server:      ${this.host}:${this.port}`);
    lines.push(`Outcome:     ${REASON_HEADLINE[this.reason]}`);
    lines.push(`Started:     ${this.startedAt.toISOString()}`);

    if (this.connectedAt) {
      const handshake = this.connectedAt.getTime() - this.startedAt.getTime();
      lines.push(
        `Connected:   ${this.connectedAt.toISOString()} (after ${formatDuration(handshake)})`,
      );
      lines.push(`Online for:  ${formatDuration(end.getTime() - this.connectedAt.getTime())}`);
    } else {
      lines.push('Connected:   never');
    }

    lines.push(`Ended:       ${end.toISOString()}`);
    lines.push(`Bytes recv:  ${this.bytesReceived}`);
    lines.push(`Bytes sent:  ${this.bytesSent}`);
    if (this.lastError) {
      lines.push(`Last error:  ${this.lastError}`);
    }
    if (this.detail) {
      lines.push(`Detail:      ${this.detail}`);
    }
    lines.push(`Note:        ${REASON_NOTE[this.reason]}`);
    lines.push(rule);

    return lines.join('\n');
  }

  /**
   * Print the report exactly once, no matter how many exit paths fire. Writes
   * to stderr by default so it survives the TUI tearing down and lands in the
   * terminal scrollback.
   */
  printOnce(write: (text: string) => void = (t) => process.stderr.write(t)): void {
    if (this.printed) return;
    this.printed = true;
    write(`\n${this.report()}\n`);
  }
}
