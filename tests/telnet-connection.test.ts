import { test, expect, describe } from 'bun:test';
import { EventEmitter } from 'events';
import { TelnetConnection } from '../src/connection/TelnetConnection';
import { SessionDiagnostics } from '../src/logging/SessionDiagnostics';

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

// Build a TelnetConnection whose fake client is an EventEmitter, then drive it
// through connect() so the real 'close'/'error' listeners get installed. This
// lets us emit lifecycle events and assert how the session diagnostics
// classify the disconnect.
async function makeConnectedConnection() {
  const socketWrites: Buffer[] = [];
  const socket = new EventEmitter() as EventEmitter & {
    write: (data: string | Buffer) => boolean;
    setKeepAlive: (enable: boolean, delay: number) => void;
  };
  socket.write = (data: string | Buffer) => {
    socketWrites.push(typeof data === 'string' ? Buffer.from(data) : data);
    return true;
  };
  socket.setKeepAlive = () => {};

  const client = new EventEmitter() as EventEmitter & {
    socket: EventEmitter;
    connect: (opts: unknown) => Promise<void>;
    end: () => Promise<void>;
  };
  client.socket = socket;
  client.connect = () => Promise.resolve();
  client.end = () => {
    client.emit('close');
    return Promise.resolve();
  };

  const diagnostics = new SessionDiagnostics('host.example.com', 4000);
  const conn = new TelnetConnection(undefined, diagnostics);
  // The App always listens for 'error'; without a listener Node's EventEmitter
  // throws when the connection re-emits one.
  conn.on('error', () => {});
  (conn as unknown as { client: unknown }).client = client;

  await conn.connect({
    id: 'test',
    name: 'test',
    protocol: 'telnet',
    host: 'host.example.com',
    port: 4000,
  });

  return { conn, client, diagnostics, socketWrites };
}

describe('TelnetConnection diagnostics', () => {
  test('a bare close is classified as a clean server close', async () => {
    const { client, diagnostics } = await makeConnectedConnection();
    client.emit('close');
    expect(diagnostics.report()).toContain('server-closed');
  });

  test('an error before close is classified as a network drop', async () => {
    const { client, diagnostics } = await makeConnectedConnection();
    client.emit('error', new Error('read ECONNRESET'));
    client.emit('close');
    const report = diagnostics.report();
    expect(report).toContain('network-error');
    expect(report).toContain('read ECONNRESET');
  });

  test('a user-initiated disconnect is classified as a normal quit', async () => {
    const { conn, diagnostics } = await makeConnectedConnection();
    await conn.disconnect();
    expect(diagnostics.report()).toContain('user-quit');
  });

  test('inbound and outbound bytes are counted', async () => {
    const { conn, client, diagnostics } = await makeConnectedConnection();
    client.emit('data', Buffer.from('hello'));
    conn.send('hi');
    const report = diagnostics.report();
    expect(report).toContain('Bytes recv:  5');
    expect(report).toContain('Bytes sent:  4'); // "hi\r\n"
  });

  test('answers Telnet negotiation by writing a reply to the socket', async () => {
    const { client, socketWrites } = await makeConnectedConnection();
    // Server: IAC DO SGA (255 253 3) mixed with real data.
    client.emit('data', Buffer.from([0x68, 0x69, 255, 253, 3])); // "hi" + IAC DO SGA
    expect(socketWrites.length).toBe(1);
    expect([...socketWrites[0]]).toEqual([255, 251, 3]); // IAC WILL SGA
  });

  test('does not surface raw IAC bytes as emitted data', async () => {
    const { conn, client } = await makeConnectedConnection();
    const received: string[] = [];
    conn.on('data', (text: string) => received.push(text));
    client.emit('data', Buffer.from([0x68, 0x69, 255, 253, 3])); // "hi" + IAC DO SGA
    expect(received).toEqual(['hi']); // negotiation stripped, only "hi" shown
  });
});

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
