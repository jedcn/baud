import { test, expect, describe } from 'bun:test';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { SessionLogger, formatHexDump } from '../src/logging/SessionLogger';

describe('formatHexDump', () => {
  test('formats a short buffer', () => {
    const buffer = Buffer.from('Hello');
    const result = formatHexDump(buffer);
    expect(result).toContain('48 65 6c 6c 6f');
    expect(result).toContain('|Hello|');
  });

  test('formats a full 16-byte line', () => {
    const buffer = Buffer.from('0123456789abcdef');
    const result = formatHexDump(buffer);
    expect(result).toBe(
      '  30 31 32 33 34 35 36 37 38 39 61 62 63 64 65 66  |0123456789abcdef|'
    );
  });

  test('formats multiple lines', () => {
    const buffer = Buffer.from('0123456789abcdefGH');
    const lines = formatHexDump(buffer).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('47 48');
    expect(lines[1]).toContain('|GH|');
  });

  test('replaces non-printable bytes with dots', () => {
    const buffer = Buffer.from([0x1b, 0x5b, 0x33, 0x31, 0x6d, 0x00, 0x7f]);
    const result = formatHexDump(buffer);
    expect(result).toContain('|.[31m..|');
  });

  test('handles empty buffer', () => {
    const buffer = Buffer.alloc(0);
    const result = formatHexDump(buffer);
    expect(result).toBe('');
  });
});

describe('SessionLogger', () => {
  const testLogPath = '/tmp/baud-test-session.log';

  function cleanup() {
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
  }

  test('creates log file with header on construction', () => {
    cleanup();
    new SessionLogger(testLogPath);
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toStartWith('# baud session log - started');
    cleanup();
  });

  test('logRecv writes RECV entry with hex dump', () => {
    cleanup();
    const logger = new SessionLogger(testLogPath);
    logger.logRecv(Buffer.from('Hello'));
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toContain('RECV (5 bytes)');
    expect(content).toContain('48 65 6c 6c 6f');
    expect(content).toContain('|Hello|');
    cleanup();
  });

  test('logSend writes SEND entry with hex dump', () => {
    cleanup();
    const logger = new SessionLogger(testLogPath);
    logger.logSend('north\r\n');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toContain('SEND (7 bytes)');
    expect(content).toContain('6e 6f 72 74 68 0d 0a');
    expect(content).toContain('|north..|');
    cleanup();
  });

  test('logs multiple entries in sequence', () => {
    cleanup();
    const logger = new SessionLogger(testLogPath);
    logger.logRecv(Buffer.from('Welcome'));
    logger.logSend('hello\r\n');
    logger.logRecv(Buffer.from('Goodbye'));
    const content = readFileSync(testLogPath, 'utf-8');
    const recvCount = (content.match(/RECV/g) || []).length;
    const sendCount = (content.match(/SEND/g) || []).length;
    expect(recvCount).toBe(2);
    expect(sendCount).toBe(1);
    cleanup();
  });
});
