// A MajorBBS/Worldgroup logon/logoff broadcast arrives with no line break of
// its own, so the server's next line is welded onto the end of it:
//
//   Pollux logs OFF.  [28-OCT-26/04:33:16] Users Online: 5: You're in a stonework corridor.
//
// A trigger anchored at "^You're in" never sees that arrival. Splitting the
// broadcast off hands triggers the two lines the server meant to send.
const BROADCAST = /^(\S+ logs O(?:N|FF)\b.*? Users Online: \d+:)\s+(\S.*)$/;

/**
 * Split a line that starts with a logon/logoff broadcast into the broadcast
 * and the line glued onto it. Any other line comes back alone.
 */
export function splitBroadcast(line: string): string[] {
  const match = BROADCAST.exec(line);
  return match ? [match[1], match[2]] : [line];
}
