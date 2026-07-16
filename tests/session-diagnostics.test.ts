import { describe, expect, test } from 'bun:test';
import { SessionDiagnostics } from '../src/logging/SessionDiagnostics';

function capture() {
  let out = '';
  return {
    write: (t: string) => {
      out += t;
    },
    get text() {
      return out;
    },
  };
}

describe('SessionDiagnostics', () => {
  test('report headline reflects a clean server close', () => {
    const d = new SessionDiagnostics('bbs.example.com', 23);
    d.markConnected();
    d.end('server-closed');
    const report = d.report();
    expect(report).toContain('baud session ended — server-closed');
    expect(report).toContain('bbs.example.com:23');
    expect(report).toContain('The server closed the connection cleanly.');
  });

  test('report headline reflects a network error and includes the last error', () => {
    const d = new SessionDiagnostics('mud.example.com', 4000);
    d.markConnected();
    d.recordError('read ECONNRESET');
    d.end('network-error');
    const report = d.report();
    expect(report).toContain('baud session ended — network-error');
    expect(report).toContain('Last error:  read ECONNRESET');
  });

  test('a connect failure shows "never" connected and the failure detail', () => {
    const d = new SessionDiagnostics('down.example.com', 23);
    d.end('connect-failed', 'connect ETIMEDOUT');
    const report = d.report();
    expect(report).toContain('Connected:   never');
    expect(report).toContain('Detail:      connect ETIMEDOUT');
  });

  test('the first terminal reason wins over a later default', () => {
    const d = new SessionDiagnostics('host', 1);
    d.end('network-error');
    // A best-effort default fired on process exit must not clobber the real reason.
    d.end('user-quit');
    expect(d.report()).toContain('network-error');
  });

  test('byte counters appear in the report', () => {
    const d = new SessionDiagnostics('host', 1);
    d.markConnected();
    d.addBytesReceived(1200);
    d.addBytesReceived(34);
    d.addBytesSent(512);
    d.end('user-quit');
    const report = d.report();
    expect(report).toContain('Bytes recv:  1234');
    expect(report).toContain('Bytes sent:  512');
  });

  test('printOnce writes the report only once', () => {
    const d = new SessionDiagnostics('host', 1);
    d.end('user-quit');
    const sink = capture();
    d.printOnce(sink.write);
    d.printOnce(sink.write);
    const occurrences = sink.text.split('baud session ended').length - 1;
    expect(occurrences).toBe(1);
  });

  test('hasEnded tracks whether a terminal reason was recorded', () => {
    const d = new SessionDiagnostics('host', 1);
    expect(d.hasEnded()).toBe(false);
    d.end('server-closed');
    expect(d.hasEnded()).toBe(true);
  });
});
