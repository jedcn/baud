import { describe, expect, it } from 'bun:test';
import { splitBroadcast } from './splitBroadcast.js';

describe('splitBroadcast', () => {
  it('splits a logoff broadcast from the line glued onto it', () => {
    expect(
      splitBroadcast(
        "Pollux logs OFF.  [28-OCT-26/04:33:16] Users Online: 5: You're in a stonework corridor.",
      ),
    ).toEqual([
      'Pollux logs OFF.  [28-OCT-26/04:33:16] Users Online: 5:',
      "You're in a stonework corridor.",
    ]);
  });

  it('splits a logon broadcast, which names the line', () => {
    expect(
      splitBroadcast(
        'Xud logs ON line 1.  [24-OCT-26/20:48:56] Users Online: 4: Kerhak has just exited Tele-Arena.',
      ),
    ).toEqual([
      'Xud logs ON line 1.  [24-OCT-26/20:48:56] Users Online: 4:',
      'Kerhak has just exited Tele-Arena.',
    ]);
  });

  it('leaves a broadcast with nothing glued on alone', () => {
    const line = 'Pollux logs OFF.  [28-OCT-26/04:33:16] Users Online: 5:';
    expect(splitBroadcast(line)).toEqual([line]);
    expect(splitBroadcast(`${line}  `)).toEqual([`${line}  `]);
  });

  it('leaves ordinary lines alone', () => {
    expect(splitBroadcast("You're in a stonework corridor.")).toEqual([
      "You're in a stonework corridor.",
    ]);
    expect(splitBroadcast('From Pelayo: Users Online: 5: hello')).toEqual([
      'From Pelayo: Users Online: 5: hello',
    ]);
  });
});
