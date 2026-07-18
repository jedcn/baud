/**
 * Minimal Telnet option negotiation (RFC 854 / RFC 858 / RFC 1143-lite).
 *
 * baud reads a raw byte stream from telnet-client (with negotiation disabled),
 * so nothing was answering the server's IAC option requests. Servers that
 * negotiate an interactive session — e.g. a MajorBBS asking for SGA + ECHO +
 * BINARY — treat a client that never replies as a broken/dead connection and
 * idle-drop it, and the unanswered IAC bytes leak into the output as garbage.
 *
 * This parser scans the whole inbound stream for IAC (0xFF) sequences — they
 * can appear anywhere in a chunk, not just at offset 0 — strips them out of
 * the application data, and returns the bytes we should send back so the
 * handshake actually completes.
 *
 * The negotiation policy is deliberately simple: agree to the handful of
 * options a screen-oriented client wants and refuse the rest. State is tracked
 * per option so we only respond when our stance changes, which prevents
 * negotiation loops.
 */

// Telnet commands (the byte after IAC).
export const IAC = 255;
export const SE = 240;
export const SB = 250;
export const WILL = 251;
export const WONT = 252;
export const DO = 253;
export const DONT = 254;

// Options we care about.
export const OPT_BINARY = 0; // RFC 856 — 8-bit clean transmission
export const OPT_ECHO = 1; // RFC 857 — who echoes typed characters
export const OPT_SGA = 3; // RFC 858 — suppress go-ahead (char-at-a-time)

/** Options we're willing to enable on our side (we answer DO x with WILL x). */
const LOCAL_SUPPORTED = new Set<number>([OPT_BINARY, OPT_SGA]);

/** Options we want the server to enable (we answer WILL x with DO x). */
const REMOTE_SUPPORTED = new Set<number>([OPT_BINARY, OPT_SGA, OPT_ECHO]);

type Mode = 'data' | 'iac' | 'will' | 'wont' | 'do' | 'dont' | 'sb' | 'sb-iac';

export interface TelnetReceiveResult {
  /** Application bytes with all IAC sequences removed. */
  data: Buffer;
  /** Negotiation bytes to write back to the server (empty if none). */
  response: Buffer;
}

export class TelnetProtocol {
  private mode: Mode = 'data';
  // What we've last told the server about each option. `true` = WILL/DO,
  // `false` = WONT/DONT, absent = never spoken. Comparing against these keeps
  // us from re-answering an option we've already settled (loop protection).
  private localWill = new Map<number, boolean>();
  private remoteDo = new Map<number, boolean>();

  /**
   * Feed an inbound chunk through the parser. The mode carries across calls,
   * so an IAC sequence split over two TCP reads is handled correctly.
   */
  receive(chunk: Buffer): TelnetReceiveResult {
    const data: number[] = [];
    const response: number[] = [];

    for (const byte of chunk) {
      switch (this.mode) {
        case 'data':
          if (byte === IAC) this.mode = 'iac';
          else data.push(byte);
          break;

        case 'iac':
          if (byte === IAC) {
            // Escaped 0xFF — a literal data byte.
            data.push(IAC);
            this.mode = 'data';
          } else if (byte === DO) this.mode = 'do';
          else if (byte === DONT) this.mode = 'dont';
          else if (byte === WILL) this.mode = 'will';
          else if (byte === WONT) this.mode = 'wont';
          else if (byte === SB) this.mode = 'sb';
          else {
            // Two-byte command with no option (NOP, GA, AYT, …): swallow it.
            this.mode = 'data';
          }
          break;

        case 'do':
          this.negotiate(this.localWill, byte, LOCAL_SUPPORTED.has(byte), WILL, WONT, response);
          this.mode = 'data';
          break;
        case 'dont':
          this.negotiate(this.localWill, byte, false, WILL, WONT, response);
          this.mode = 'data';
          break;
        case 'will':
          this.negotiate(this.remoteDo, byte, REMOTE_SUPPORTED.has(byte), DO, DONT, response);
          this.mode = 'data';
          break;
        case 'wont':
          this.negotiate(this.remoteDo, byte, false, DO, DONT, response);
          this.mode = 'data';
          break;

        case 'sb':
          // Swallow subnegotiation payload until IAC SE. We don't implement any
          // suboption (TTYPE/NAWS), but we must not let the bytes reach output.
          if (byte === IAC) this.mode = 'sb-iac';
          break;
        case 'sb-iac':
          if (byte === SE) this.mode = 'data';
          else this.mode = 'sb'; // escaped IAC inside SB, keep swallowing
          break;
      }
    }

    return { data: Buffer.from(data), response: Buffer.from(response) };
  }

  /**
   * Decide how to answer a DO/DONT/WILL/WONT for one option. Emits a reply only
   * when our recorded stance actually changes, so a repeated request (or a
   * refusal we've already sent) produces no further traffic.
   */
  private negotiate(
    state: Map<number, boolean>,
    option: number,
    desired: boolean,
    affirm: number,
    refuse: number,
    response: number[],
  ): void {
    if (state.get(option) === desired) return;
    state.set(option, desired);
    response.push(IAC, desired ? affirm : refuse, option);
  }
}
