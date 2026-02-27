import { test, expect, describe, beforeEach } from 'bun:test';
import { EchoTriggerManager } from '../src/triggers/EchoTriggerManager';
import { LuaEngine } from '../src/scripting/LuaEngine';
import { TriggerManager } from '../src/triggers/TriggerManager';

describe('Echo Triggers', () => {
  let echoTriggerManager: EchoTriggerManager;
  let triggerManager: TriggerManager;
  let luaEngine: LuaEngine;
  let sentCommands: string[];
  let echoedMessages: string[];

  beforeEach(async () => {
    sentCommands = [];
    echoedMessages = [];

    echoTriggerManager = new EchoTriggerManager();
    triggerManager = new TriggerManager();

    luaEngine = new LuaEngine({
      send: (text: string) => {
        sentCommands.push(text);
      },
      echo: (text: string) => {
        echoTriggerManager.processEcho(text);
        echoedMessages.push(text);
      },
      cecho: (color: string, text: string) => {
        echoTriggerManager.processEcho(text);
        echoedMessages.push(`[${color}]${text}`);
      },
      createTrigger: (pattern: string, callback: any, options?: any) => {
        return triggerManager.createTrigger(pattern, callback, options);
      },
      createOutboundTrigger: () => '',
      createEchoTrigger: (pattern: string, callback: any, options?: any) => {
        return echoTriggerManager.createEchoTrigger(pattern, callback, options);
      },
      createAlias: () => '',
      createTimer: () => '',
      getTimers: () => [],
      removeTimer: () => false,
      enableTimer: () => {},
      disableTimer: () => {},
      setStatus: () => {},
      reloadScript: async () => {},
    });

    await luaEngine.initialize();
  });

  test('echo trigger fires on literal substring match', async () => {
    await luaEngine.execute(`
      createEchoTrigger("hello", function()
        sentResults = "matched hello"
      end)
    `);

    await echoTriggerManager.processEcho('hello world');

    const result = await luaEngine.execute('return sentResults');
    expect(result.result).toBe('matched hello');
  });

  test('echo trigger does not fire on non-matching text', async () => {
    await luaEngine.execute(`
      fired = false
      createEchoTrigger("hello", function()
        fired = true
      end)
    `);

    await echoTriggerManager.processEcho('goodbye world');

    const result = await luaEngine.execute('return fired');
    expect(result.result).toBe(false);
  });

  test('echo trigger fires on regex match with capture groups', async () => {
    await luaEngine.execute(`
      capturedValue = nil
      createEchoTrigger("^HP: (\\\\d+)/(\\\\d+)$", function(matches)
        capturedValue = matches[2]
      end, { type = "regex" })
    `);

    await echoTriggerManager.processEcho('HP: 75/100');

    const result = await luaEngine.execute('return capturedValue');
    expect(result.result).toBe('75');
  });

  test('multiple matching echo triggers all fire', async () => {
    await luaEngine.execute(`
      count = 0
      createEchoTrigger("health", function()
        count = count + 1
      end)
      createEchoTrigger("^HP:", function()
        count = count + 1
      end, { type = "regex" })
    `);

    await echoTriggerManager.processEcho('HP: 75/100 health');

    const result = await luaEngine.execute('return count');
    expect(result.result).toBe(2);
  });

  test('disabled echo trigger does not fire', async () => {
    await luaEngine.execute(`
      fired = false
      createEchoTrigger("hello", function()
        fired = true
      end, { enabled = false })
    `);

    await echoTriggerManager.processEcho('hello world');

    const result = await luaEngine.execute('return fired');
    expect(result.result).toBe(false);
  });

  test('lua error in echo trigger callback is handled via onError', async () => {
    const errors: string[] = [];
    const errorHandler = (error: Error) => {
      errors.push(error.message);
    };

    await luaEngine.execute(`
      createEchoTrigger("test", function(matches)
        local x = matches + 1
      end)
    `);

    await echoTriggerManager.processEcho('test', errorHandler);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('attempt');
  });

  test('echo trigger fires when echo() is called from Lua', async () => {
    await luaEngine.execute(`
      echoSeen = false
      createEchoTrigger("script output", function()
        echoSeen = true
      end)
    `);

    // Call echo() via Lua — this goes through our mock which calls processEcho
    await luaEngine.execute(`echo("script output here")`);

    const result = await luaEngine.execute('return echoSeen');
    expect(result.result).toBe(true);
  });

  test('echo trigger fires when cecho() is called from Lua', async () => {
    await luaEngine.execute(`
      cechoSeen = false
      createEchoTrigger("colored text", function()
        cechoSeen = true
      end)
    `);

    // Call cecho() via Lua — mock calls processEcho on the text portion
    await luaEngine.execute(`cecho("#ff0000", "colored text here")`);

    const result = await luaEngine.execute('return cechoSeen');
    expect(result.result).toBe(true);
  });

  test('clearEchoTriggers removes all triggers', async () => {
    await luaEngine.execute(`
      fired = false
      createEchoTrigger("test", function()
        fired = true
      end)
    `);

    echoTriggerManager.clearEchoTriggers();
    await echoTriggerManager.processEcho('test');

    const result = await luaEngine.execute('return fired');
    expect(result.result).toBe(false);
  });
});
