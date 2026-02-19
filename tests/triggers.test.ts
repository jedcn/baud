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
      createAlias: () => '',
      createTimer: () => '',
      getTimers: () => [],
      removeTimer: () => false,
      enableTimer: () => {},
      disableTimer: () => {},
      setStatus: () => {},
      cecho: (color: string, text: string) => {
        echoedMessages.push(`[${color}]${text}`);
      },
    });

    await luaEngine.initialize();
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
    await triggerManager.processLine('You have been poisoned!');

    // Verify
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
    await triggerManager.processLine('You feel fine.');

    // Verify
    expect(sentCommands).toHaveLength(0);
  });

  test('regex trigger with escaped backslash and captures', async () => {
    // This tests the fix for the backslash escaping issue
    await luaEngine.execute(`
      createTrigger("^You have (\\\\d+)/(\\\\d+) health", function(matches)
        local current = tonumber(matches[2])  -- First capture group
        local max = tonumber(matches[3])      -- Second capture group
        local percent = (current / max) * 100
        echo(string.format("Health: %.0f%%", percent))

        if percent < 30 then
          send("flee")
          echo("Health critical!")
        end
      end, { type = "regex" })
    `);

    // Process matching line with low health
    await triggerManager.processLine('You have 25/100 health');

    // Verify
    expect(echoedMessages).toContain('Health: 25%');
    expect(echoedMessages).toContain('Health critical!');
    expect(sentCommands).toContain('flee');

    // Reset
    sentCommands = [];
    echoedMessages = [];

    // Process matching line with high health
    await triggerManager.processLine('You have 80/100 health');

    // Should echo but not flee
    expect(echoedMessages).toContain('Health: 80%');
    expect(sentCommands).toHaveLength(0);
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
        local player = matches[2]  -- First capture group
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

  test('lua error in trigger callback is handled gracefully', async () => {
    const errors: string[] = [];
    const errorHandler = (error: Error) => {
      errors.push(error.message);
    };

    await luaEngine.execute(`
      createTrigger("test", function(matches)
        -- This will error
        local x = matches + 1
      end)
    `);

    await triggerManager.processLine('test', errorHandler);

    // Error should be caught and passed to handler
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('attempt');
  });

  test('accessing non-existent capture group in trigger returns nil not error', async () => {
    await luaEngine.execute(`
      createTrigger("test", function(matches)
        -- matches is now always a table (even if empty for literal matches)
        local value = matches[2] or "no match"  -- No captures, so nil
        echo("Value: " .. value)
      end)
    `);

    await triggerManager.processLine('test');

    expect(echoedMessages).toContain('Value: no match');
  });

  test('cecho outputs colored text', async () => {
    await luaEngine.execute(`
      cecho("red", "Danger!")
    `);

    expect(echoedMessages).toContain('[red]Danger!');
  });

  test('cecho from trigger callback', async () => {
    await luaEngine.execute(`
      createTrigger("damage", function()
        cecho("red", "You took damage!")
      end)
    `);

    await triggerManager.processLine('You take 10 damage');

    expect(echoedMessages).toContain('[red]You took damage!');
  });

  test('matches[1] contains full matched string in trigger', async () => {
    await luaEngine.execute(`
      createTrigger("^(\\\\w+) tells you", function(matches)
        local fullMatch = matches[1]  -- Full match
        local player = matches[2]     -- First capture
        echo("Full: " .. fullMatch)
        echo("Player: " .. player)
      end, { type = "regex" })
    `);

    await triggerManager.processLine('Alice tells you: hello');

    expect(echoedMessages).toContain('Full: Alice tells you');
    expect(echoedMessages).toContain('Player: Alice');
  });
});
