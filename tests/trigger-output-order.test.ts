import { describe, expect, test } from 'bun:test';
import { ANSIParser } from '../src/connection/ANSIParser';
import { LuaEngine } from '../src/scripting/LuaEngine';
import { TriggerManager } from '../src/triggers/TriggerManager';
import { processIncomingData } from '../src/ui/processIncomingData';

// A trigger's echo used to appear ABOVE the line that fired it: triggers ran
// before the server line was drawn, so "HIT 77" landed first and the blow that
// dealt the 77 came after it. The echo is a reaction to the line, so it belongs
// beneath it.
describe('trigger output ordering', () => {
  async function setup() {
    const screen: string[] = [];
    const triggerManager = new TriggerManager();
    const engine = new LuaEngine({
      send: () => {},
      echo: (text: string) => {
        screen.push(text);
      },
      createTrigger: (pattern: string, callback: any, options?: any) =>
        triggerManager.createTrigger(pattern, callback, options),
      createOutboundTrigger: () => '',
      createAlias: () => '',
      createTimer: () => '',
      getTimers: () => [],
      getAliases: () => [],
      getTriggers: () => [],
      getOutboundTriggers: () => [],
      removeTimer: () => false,
      enableTimer: () => {},
      disableTimer: () => {},
      setStatus: () => {},
    });
    await engine.initialize();
    const receive = (data: string) =>
      processIncomingData(data, {
        ansiParser: new ANSIParser(),
        triggerManager,
        display: (line) => screen.push(line),
        onError: (e) => {
          throw e;
        },
      });
    return { engine, screen, receive };
  }

  test("a trigger's echo appears beneath the line that fired it", async () => {
    const { engine, screen, receive } = await setup();
    await engine.execute(`
      createTrigger("for (\\\\d+) damage", function(m)
        echo("HIT " .. m[2])
      end, { type = "regex" })
    `);

    await receive('Your attack hit the elven warrior for 77 damage!\r\n');

    expect(screen).toEqual(['Your attack hit the elven warrior for 77 damage!', 'HIT 77']);
  });

  test('each echo follows its own line when several arrive in one packet', async () => {
    const { engine, screen, receive } = await setup();
    await engine.execute(`
      createTrigger("for (\\\\d+) damage", function(m)
        echo("HIT " .. m[2])
      end, { type = "regex" })
    `);

    await receive('You hit for 5 damage!\r\nThe orc snarls.\r\nYou hit for 9 damage!\r\n');

    expect(screen).toEqual([
      'You hit for 5 damage!',
      'HIT 5',
      'The orc snarls.',
      'You hit for 9 damage!',
      'HIT 9',
    ]);
  });
});
