import { describe, expect, test } from 'bun:test';
import { describeConnectError, toError } from '../src/connection/connectError';

function codedError(code: string, message = 'boom'): Error {
  return Object.assign(new Error(message), { code });
}

describe('describeConnectError', () => {
  test('maps socket error codes to phrases a user can act on', () => {
    expect(describeConnectError(codedError('ECONNREFUSED'))).toBe('Connection refused');
    expect(describeConnectError(codedError('ETIMEDOUT'))).toBe('Operation timed out');
    expect(describeConnectError(codedError('ENOTFOUND'))).toBe('Unknown host');
    expect(describeConnectError(codedError('EHOSTUNREACH'))).toBe('No route to host');
    expect(describeConnectError(codedError('ECONNRESET'))).toBe('Connection reset by peer');
  });

  test("reads telnet-client's connect timeout as a timeout", () => {
    // The unresponsive-host case: telnet-client emits this as a bare string.
    expect(describeConnectError('Cannot connect')).toBe('Operation timed out');
    expect(describeConnectError(new Error('Cannot connect'))).toBe('Operation timed out');
  });

  test('describes a socket that closed during the handshake', () => {
    expect(describeConnectError(new Error('Socket closes'))).toBe(
      'Connection closed by remote host',
    );
  });

  test('falls back to the raw message, never an empty string', () => {
    expect(describeConnectError(new Error('something odd'))).toBe('something odd');
    expect(describeConnectError(new Error(''))).toBe('Unknown error');
    expect(describeConnectError(undefined)).toBe('Unknown error');
  });
});

describe('toError', () => {
  test('passes Errors through and wraps strings', () => {
    const error = new Error('nope');
    expect(toError(error)).toBe(error);
    expect(toError('Cannot connect').message).toBe('Cannot connect');
    expect(toError(null).message).toBe('Unknown error');
  });
});
