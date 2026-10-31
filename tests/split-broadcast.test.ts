import { describe, expect, test } from 'bun:test';
import { ANSIParser } from '../src/connection/ANSIParser';
import { TriggerManager } from '../src/triggers/TriggerManager';
import { processIncomingData } from '../src/ui/processIncomingData';

// The BBS's logon/logoff broadcast has no line break of its own, so the next
// server line arrives glued to it and a trigger anchored at "^" misses it.
describe('a glued-on BBS broadcast', () => {
  const glued =
    "Pollux logs OFF.  [28-OCT-26/04:33:16] Users Online: 5: You're in a stonework corridor.";

  async function receive(data: string) {
    const screen: string[] = [];
    const fired: string[] = [];
    const triggerManager = new TriggerManager();
    triggerManager.createTrigger("^You're in (.+)\\.$", (m) => fired.push(`arrival ${m[1]}`), {
      type: 'regex',
    });
    triggerManager.createTrigger('^(\\S+) logs OFF', (m) => fired.push(`logoff ${m[1]}`), {
      type: 'regex',
    });
    await processIncomingData(data, {
      ansiParser: new ANSIParser(),
      triggerManager,
      display: (line) => screen.push(line),
      onError: (e) => {
        throw e;
      },
    });
    return { screen, fired };
  }

  test('fires triggers for both the broadcast and the glued line', async () => {
    const { fired } = await receive(`${glued}\r\n`);
    expect(fired).toEqual(['logoff Pollux', 'arrival a stonework corridor']);
  });

  test('is displayed as the server sent it', async () => {
    const { screen } = await receive(`${glued}\r\n`);
    expect(screen).toEqual([glued]);
  });
});
