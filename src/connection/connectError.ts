/**
 * Turns whatever a failed connection throws at us into a short phrase the user
 * can act on, in the spirit of what stock `telnet` prints:
 *
 *   telnet: connect to address 97.106.9.116: Operation timed out
 *
 * telnet-client is loose about what it reports — sometimes a Node socket error
 * carrying a `code`, sometimes a bare string from its own connect timeout — so
 * both shapes are normalised here.
 */
export function describeConnectError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;

  switch (code) {
    case 'ECONNREFUSED':
      return 'Connection refused';
    case 'ETIMEDOUT':
      return 'Operation timed out';
    case 'EHOSTUNREACH':
      return 'No route to host';
    case 'ENETUNREACH':
      return 'Network is unreachable';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'Unknown host';
    case 'ECONNRESET':
      return 'Connection reset by peer';
    case 'EPIPE':
      return 'Connection closed by remote host';
  }

  const message = toError(error).message;

  switch (message) {
    // telnet-client's connect-phase timeout: we sent a SYN and the host never
    // answered, which from here is indistinguishable from — and reads the same
    // to a user as — a plain connect timeout.
    case 'Cannot connect':
      return 'Operation timed out';
    case 'Socket closes':
    case 'Socket ends':
      return 'Connection closed by remote host';
    default:
      return message || 'Unknown error';
  }
}

/** Coerce a thrown/emitted value into an Error, since telnet-client emits strings. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error('Unknown error');
}
