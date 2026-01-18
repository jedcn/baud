import { test, expect, describe, beforeEach } from 'bun:test';
import { TriggerManager } from '../src/triggers/TriggerManager';
import { LuaEngine } from '../src/scripting/LuaEngine';

describe('Triggers', () => {
  let triggerManager: TriggerManager;
  let luaEngine: LuaEngine;
  let sentCommands: string[];
  let echoedMessages: string[];

  beforeEach(async () => {
    // Reset captured output
    sentCommands = [];
    echoedMessages = [];

    // Create trigger manager
    triggerManager = new TriggerManager();

    // Create Lua engine with mock API
    luaEngine = new LuaEngine({
      send: (text: string) => {
        sentCommands.push(text);
      },
      echo: (text: string) => {
        echoedMessages.push(text);
      },
      createTrigger: (pattern: string, callback: any, options?: any) => {
        return triggerManager.createTrigger(pattern, callback, options);
      },
      createAlias: () => '', // Not needed for trigger tests
    });

    await luaEngine.initialize();
    triggerManager.setLuaEngine(luaEngine);
  });

  test('simple literal trigger fires on matching text', async () => {
    // Create a simple trigger
    await luaEngine.execute(`
      createTrigger("You have been poisoned!", function()
        send("drink antidote")
        echo("Auto-cured poison!")
      end)
    `);

    // Process matching line
    const shouldGag = await triggerManager.processLine('You have been poisoned!');

    // Verify
    expect(shouldGag).toBe(false);
    expect(sentCommands).toContain('drink antidote');
    expect(echoedMessages).toContain('Auto-cured poison!');
  });

  test('literal trigger does not fire on non-matching text', async () => {
    await luaEngine.execute(`
      createTrigger("You have been poisoned!", function()
        send("drink antidote")
      end)
    `);

    // Process non-matching line
    const shouldGag = await triggerManager.processLine('You feel fine.');

    // Verify
    expect(shouldGag).toBe(false);
    expect(sentCommands).toHaveLength(0);
  });

  test('regex trigger with escaped backslash and captures', async () => {
    // This tests the fix for the backslash escaping issue
    await luaEngine.execute(`
      createTrigger("^You have (\\\\d+)/(\\\\d+) health", function(matches)
        local current = tonumber(matches[1])
        local max = tonumber(matches[2])
        local percent = (current / max) * 100
        echo(string.format("Health: %.0f%%", percent))

        if percent < 30 then
          send("flee")
          echo("Health critical!")
        end
      end, { type = "regex" })
    `);

    // Process matching line with low health
    let shouldGag = await triggerManager.processLine('You have 25/100 health');

    // Verify
    expect(shouldGag).toBe(false);
    expect(echoedMessages).toContain('Health: 25%');
    expect(echoedMessages).toContain('Health critical!');
    expect(sentCommands).toContain('flee');

    // Reset
    sentCommands = [];
    echoedMessages = [];

    // Process matching line with high health
    shouldGag = await triggerManager.processLine('You have 80/100 health');

    // Should echo but not flee
    expect(echoedMessages).toContain('Health: 80%');
    expect(sentCommands).toHaveLength(0);
  });

  test('trigger with gag option hides matching line', async () => {
    await luaEngine.execute(`
      createTrigger("The shopkeeper yawns.", function()
        -- Do nothing, just hide the line
      end, { gag = true })
    `);

    // Process matching line
    const shouldGag = await triggerManager.processLine('The shopkeeper yawns.');

    // Should be gagged
    expect(shouldGag).toBe(true);
  });

  test('trigger without gag option does not hide line', async () => {
    await luaEngine.execute(`
      createTrigger("Hello", function()
        echo("Received greeting")
      end)
    `);

    // Process matching line
    const shouldGag = await triggerManager.processLine('Hello');

    // Should not be gagged
    expect(shouldGag).toBe(false);
    expect(echoedMessages).toContain('Received greeting');
  });

  test('multiple triggers can fire on same line', async () => {
    await luaEngine.execute(`
      createTrigger("attack", function()
        echo("Attack detected!")
      end)

      createTrigger("monster attack", function()
        echo("Monster attack!")
        send("defend")
      end)
    `);

    // Both triggers should fire
    await triggerManager.processLine('The monster attacks you!');

    // Verify both executed
    expect(echoedMessages).toContain('Attack detected!');
    expect(echoedMessages).toContain('Monster attack!');
    expect(sentCommands).toContain('defend');
  });

  test('trigger priority determines execution order', async () => {
    const executionOrder: string[] = [];

    await luaEngine.execute(`
      createTrigger("test", function()
        echo("low priority")
      end, { priority = 1 })

      createTrigger("test", function()
        echo("high priority")
      end, { priority = 10 })

      createTrigger("test", function()
        echo("medium priority")
      end, { priority = 5 })
    `);

    // Process line
    await triggerManager.processLine('test');

    // Verify execution order (high to low priority)
    expect(echoedMessages).toEqual(['high priority', 'medium priority', 'low priority']);
  });

  test('disabled trigger does not fire', async () => {
    await luaEngine.execute(`
      createTrigger("test", function()
        send("should not execute")
      end, { enabled = false })
    `);

    await triggerManager.processLine('test');

    expect(sentCommands).toHaveLength(0);
  });

  test('regex trigger with word boundary matches correctly', async () => {
    await luaEngine.execute(`
      createTrigger("^(\\\\w+) tells you", function(matches)
        local player = matches[1]
        echo("Message from: " .. player)
      end, { type = "regex" })
    `);

    // Process matching line
    await triggerManager.processLine('Alice tells you: hello');

    // Verify
    expect(echoedMessages).toContain('Message from: Alice');
  });

  test('literal trigger matches partial text', async () => {
    await luaEngine.execute(`
      createTrigger("poisoned", function()
        echo("Poison detected!")
      end)
    `);

    // Should match anywhere in the line
    await triggerManager.processLine('You have been poisoned by the snake!');

    expect(echoedMessages).toContain('Poison detected!');
  });
});
