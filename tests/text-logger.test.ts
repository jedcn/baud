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
});
