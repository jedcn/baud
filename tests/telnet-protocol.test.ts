import { describe, expect, test } from 'bun:test';
import {
  DO,
  DONT,
  IAC,
  OPT_BINARY,
  OPT_ECHO,
  OPT_SGA,
  SB,
  SE,
  TelnetProtocol,
  WILL,
  WONT,
} from '../src/connection/TelnetProtocol';

const hex = (b: Buffer) => b.toString('hex');

describe('TelnetProtocol', () => {
  test('passes plain data through untouched', () => {
    const t = new TelnetProtocol();
    const { data, response } = t.receive(Buffer.from('hello world'));
    expect(data.toString()).toBe('hello world');
    expect(response.length).toBe(0);
  });

  test('replays the saturn5 handshake exactly (SGA + ECHO + BINARY)', () => {
    // The exact negotiation bbs.saturn5bbs.com sends at connect, mid-stream
    // after "Please Wait...". A conformant client (verified via `telnet -d`)
    // answers: WILL SGA / DO SGA / WONT ECHO / DO ECHO / WILL BINARY / DO BINARY.
    const t = new TelnetProtocol();
    const chunk = Buffer.from([
      // eslint-disable-next-line prettier/prettier
      0x0a,
      IAC, DO, OPT_SGA,
      IAC, WILL, OPT_SGA,
      IAC, DONT, OPT_ECHO,
      IAC, WILL, OPT_ECHO,
      IAC, DO, OPT_BINARY,
      IAC, WILL, OPT_BINARY,
    ]);
    const { data, response } = t.receive(chunk);

    // The lone newline is real data; every IAC sequence is stripped.
    expect(data).toEqual(Buffer.from([0x0a]));

    expect(response).toEqual(
      Buffer.from([
        IAC, WILL, OPT_SGA,
        IAC, DO, OPT_SGA,
        IAC, WONT, OPT_ECHO,
        IAC, DO, OPT_ECHO,
        IAC, WILL, OPT_BINARY,
        IAC, DO, OPT_BINARY,
      ]),
    );
  });

  test('refuses options it does not support', () => {
    const t = new TelnetProtocol();
    // Server offers to do, and asks us to do, some option we don't handle (e.g. 24 = TTYPE).
    const { response } = t.receive(Buffer.from([IAC, WILL, 24, IAC, DO, 24]));
    expect(response).toEqual(Buffer.from([IAC, DONT, 24, IAC, WONT, 24]));
  });

  test('does not re-answer an already-settled option (loop protection)', () => {
    const t = new TelnetProtocol();
    const first = t.receive(Buffer.from([IAC, DO, OPT_SGA]));
    expect(first.response).toEqual(Buffer.from([IAC, WILL, OPT_SGA]));
    // A duplicate DO SGA must produce no further traffic.
    const second = t.receive(Buffer.from([IAC, DO, OPT_SGA]));
    expect(second.response.length).toBe(0);
  });

  test('handles an IAC sequence split across two chunks', () => {
    const t = new TelnetProtocol();
    const a = t.receive(Buffer.from([0x41, IAC])); // "A" then a dangling IAC
    expect(a.data).toEqual(Buffer.from([0x41]));
    expect(a.response.length).toBe(0);
    const b = t.receive(Buffer.from([DO, OPT_SGA, 0x42])); // completes IAC DO SGA, then "B"
    expect(b.data).toEqual(Buffer.from([0x42]));
    expect(b.response).toEqual(Buffer.from([IAC, WILL, OPT_SGA]));
  });

  test('unescapes a literal 0xFF (IAC IAC) into the data stream', () => {
    const t = new TelnetProtocol();
    const { data } = t.receive(Buffer.from([0x61, IAC, IAC, 0x62]));
    expect(data).toEqual(Buffer.from([0x61, 0xff, 0x62]));
  });

  test('swallows subnegotiation blocks (IAC SB ... IAC SE)', () => {
    const t = new TelnetProtocol();
    const { data, response } = t.receive(
      Buffer.from([0x61, IAC, SB, 24, 1, 0x2e, 0x2e, IAC, SE, 0x62]),
    );
    expect(data).toEqual(Buffer.from([0x61, 0x62]));
    expect(response.length).toBe(0);
  });

  test('ignores bare two-byte commands like NOP without emitting data', () => {
    const t = new TelnetProtocol();
    const NOP = 241;
    const { data, response } = t.receive(Buffer.from([0x61, IAC, NOP, 0x62]));
    expect(data).toEqual(Buffer.from([0x61, 0x62]));
    expect(response.length).toBe(0);
  });

  test('strips IAC that arrives mid-chunk, not just at offset 0', () => {
    const t = new TelnetProtocol();
    const { data } = t.receive(Buffer.from([...Buffer.from('abc'), IAC, DO, OPT_SGA, 0x64]));
    expect(data.toString()).toBe('abcd');
  });
});
