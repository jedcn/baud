import { test, expect, describe } from 'bun:test';
import { EventEmitter } from 'events';
import { TelnetConnection } from '../src/connection/TelnetConnection';

// Build a TelnetConnection wired to a fake telnet-client whose `socket` is a
// real EventEmitter, so we can both record outbound writes and watch the
// 'data' listener count the way Node's MaxListeners warning does.
function makeConnection() {
  const writes: string[] = [];
  const socket = new EventEmitter() as EventEmitter & {
    write: (data: string) => boolean;
  };
  socket.write = (data: string) => {
    writes.push(data);
    return true;
  };

  let sendCalls = 0;
  const fakeClient = {
    socket,
    send: (_payload: string) => {
      sendCalls += 1;
      return Promise.resolve('');
    },
  };

  const conn = new TelnetConnection();
  // Inject our fake in place of the real Telnet instance and mark connected,
  // which is what connect() would do against a live server.
  (conn as unknown as { client: unknown }).client = fakeClient;
  (conn as unknown as { connected: boolean }).connected = true;

  return { conn, socket, writes, sendCalls: () => sendCalls };
}

describe('TelnetConnection.send', () => {
  test('writes the command with a CRLF terminator to the socket', () => {
    const { conn, writes } = makeConnection();
    conn.send('look');
    expect(writes).toEqual(['look\r\n']);
  });

  test('bypasses telnet-client send() so no per-send listener machinery runs', () => {
    const { conn, sendCalls } = makeConnection();
    conn.send('look');
    expect(sendCalls()).toBe(0);
  });

  test('does not accumulate socket data listeners across a burst of sends', () => {
    // The bug: telnet-client's send() attaches a one-shot 'data' listener per
    // call that only drains on the next inbound data event, so a burst stacks
    // listeners until Node warns about a leak. Writing straight to the socket
    // must never add a 'data' listener at all.
    const { conn, socket } = makeConnection();
    for (let i = 0; i < 50; i++) {
      conn.send('ring gong');
    }
    expect(socket.listenerCount('data')).toBe(0);
  });

  test('does nothing when not connected', () => {
    const { conn, writes } = makeConnection();
    (conn as unknown as { connected: boolean }).connected = false;
    conn.send('look');
    expect(writes).toEqual([]);
  });

  test('sends a bare CRLF for an empty command', () => {
    const { conn, writes } = makeConnection();
    conn.send('');
    expect(writes).toEqual(['\r\n']);
  });
});
