import { test, expect, describe } from 'bun:test';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { TextLogger } from '../src/logging/TextLogger';

describe('TextLogger', () => {
  const testLogPath = '/tmp/baud-test-text.log';

  function cleanup() {
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
  }

  test('creates log file with header on construction', () => {
    cleanup();
    new TextLogger(testLogPath);
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toStartWith('# baud text log - started');
    cleanup();
  });

  test('names baud\'s version in the header, after the start time', () => {
    cleanup();
    new TextLogger(testLogPath, '9d763ba');
    const header = readFileSync(testLogPath, 'utf-8').split('\n')[0];
    expect(header).toMatch(/^# baud text log - started \S+Z - baud 9d763ba$/);
    // What the scripts' log reader takes as the start time: the next word only.
    expect(header.match(/^# baud text log - started (\S+)/)?.[1]).toEndWith('Z');
    cleanup();
  });

  test('leaves the version out of the header when none is given', () => {
    cleanup();
    new TextLogger(testLogPath);
    const header = readFileSync(testLogPath, 'utf-8').split('\n')[0];
    expect(header).toMatch(/^# baud text log - started \S+Z$/);
    cleanup();
  });

  test('logRecv appends plain text with newline', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logRecv('Welcome to the realm!');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toContain('Welcome to the realm!\n');
    cleanup();
  });

  test('logSend appends text with > prefix', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logSend('go north');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toContain('> go north\n');
    cleanup();
  });

  // An alias never reaches the server, so it gets no `> ` line, and a log of a
  // scripted session could not say which aliases ran or when. Replaying one
  // meant guessing. `$ ` records it without claiming it was sent.
  test('logAlias appends text with $ prefix', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logAlias('map-area caves The Caves');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toContain('$ map-area caves The Caves\n');
    cleanup();
  });

  test('logAlias does not use the > prefix that means sent-to-server', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logAlias('map-off');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).not.toContain('> map-off');
    cleanup();
  });

  test('keeps aliases, sends and server output in one ordered stream', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logAlias('map-area caves');
    logger.logSend('ex');
    logger.logRecv('Exits: n,s.');
    const content = readFileSync(testLogPath, 'utf-8');
    const aliasAt = content.indexOf('$ map-area caves');
    const sendAt = content.indexOf('> ex');
    const recvAt = content.indexOf('Exits: n,s.');
    expect(aliasAt).toBeGreaterThan(-1);
    expect(sendAt).toBeGreaterThan(aliasAt);
    expect(recvAt).toBeGreaterThan(sendAt);
    cleanup();
  });

  test('logRecv does not add > prefix', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logRecv('Server says hello');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).not.toContain('> Server says hello');
    cleanup();
  });

  test('logs multiple entries in sequence', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logRecv('You are in a dark room.');
    logger.logSend('look');
    logger.logRecv('There is a door to the north.');
    logger.logSend('go north');
    const content = readFileSync(testLogPath, 'utf-8');
    expect(content).toContain('You are in a dark room.\n');
    expect(content).toContain('> look\n');
    expect(content).toContain('There is a door to the north.\n');
    expect(content).toContain('> go north\n');
    // Verify order
    const lookIdx = content.indexOf('> look');
    const doorIdx = content.indexOf('There is a door');
    expect(lookIdx).toBeLessThan(doorIdx);
    cleanup();
  });

  test('logRecv handles empty string', () => {
    cleanup();
    const logger = new TextLogger(testLogPath);
    logger.logRecv('');
    const content = readFileSync(testLogPath, 'utf-8');
    // Should not throw, just append a newline
    expect(content).toBeDefined();
    cleanup();
  });

  // Logs had almost no clock, so fights could only be timed by counting polls.
  test('stamps the first entry of each second, and only the first', () => {
    cleanup();
    const realDate = globalThis.Date;
    let clock = '2026-11-07T08:12:58';
    globalThis.Date = class extends realDate {
      constructor() {
        super(clock);
      }
    } as DateConstructor;
    try {
      const logger = new TextLogger(testLogPath);
      logger.logRecv('one');
      logger.logSend('two');
      clock = '2026-11-07T08:12:59';
      logger.logAlias('three');
      const lines = readFileSync(testLogPath, 'utf-8').split('\n').slice(2, -1);
      expect(lines).toEqual([
        '[T] 08:12:58 tick',
        'one',
        '> two',
        '[T] 08:12:59 tick',
        '$ three',
      ]);
    } finally {
      globalThis.Date = realDate;
      cleanup();
    }
  });
});
