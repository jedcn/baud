import { test, expect, describe, beforeEach } from 'bun:test';
import { AliasManager } from '../src/aliases/AliasManager';
import { LuaEngine } from '../src/scripting/LuaEngine';

describe('Aliases', () => {
  let aliasManager: AliasManager;
  let luaEngine: LuaEngine;
  let sentCommands: string[];
  let echoedMessages: string[];

  beforeEach(async () => {
    // Reset captured output
    sentCommands = [];
    echoedMessages = [];

    // Create alias manager
    aliasManager = new AliasManager();

    // Create Lua engine with mock API
    luaEngine = new LuaEngine({
      send: (text: string) => {
        sentCommands.push(text);
      },
      echo: (text: string) => {
        echoedMessages.push(text);
      },
      createTrigger: () => '', // Not needed for alias tests
      createAlias: (pattern: string, callback: any, options?: any) => {
        return aliasManager.createAlias(pattern, callback, options);
      },
    });

    await luaEngine.initialize();
    aliasManager.setLuaEngine(luaEngine);
  });

  test('simple literal alias expands correctly', async () => {
    // Create a simple alias
    await luaEngine.execute(`
      createAlias("test", function()
        send("test command executed")
      end)
    `);

    // Process input
    const matched = await aliasManager.processInput('test');

    // Verify
    expect(matched).toBe(true);
    expect(sentCommands).toContain('test command executed');
  });

  test('literal alias does not match partial input', async () => {
    await luaEngine.execute(`
      createAlias("test", function()
        send("test command executed")
      end)
    `);

    // Process different input
    const matched = await aliasManager.processInput('test123');

    // Should not match
    expect(matched).toBe(false);
    expect(sentCommands).toHaveLength(0);
  });

  test('regex alias with escaped backslash matches correctly', async () => {
    // This tests the fix for the backslash escaping issue
    await luaEngine.execute(`
      createAlias("^greet (\\\\w+)$", function(matches)
        local fullMatch = matches[1]  -- Full matched string
        local name = matches[2]       -- First capture group
        send("say Hello, " .. name .. "!")
        send("emote waves at " .. name)
      end, { type = "regex" })
    `);

    // Process matching input
    const matched = await aliasManager.processInput('greet jed');

    // Verify
    expect(matched).toBe(true);
    expect(sentCommands).toContain('say Hello, jed!');
    expect(sentCommands).toContain('emote waves at jed');
  });

  test('regex alias with multiple captures', async () => {
    await luaEngine.execute(`
      createAlias("^move (\\\\w+) (\\\\d+)$", function(matches)
        local direction = matches[2]     -- First capture group
        local times = tonumber(matches[3])  -- Second capture group
        for i = 1, times do
          send(direction)
        end
        echo("Moved " .. direction .. " " .. times .. " times")
      end, { type = "regex" })
    `);

    // Process input
    const matched = await aliasManager.processInput('move north 3');

    // Verify
    expect(matched).toBe(true);
    expect(sentCommands).toEqual(['north', 'north', 'north']);
    expect(echoedMessages).toContain('Moved north 3 times');
  });

  test('regex alias does not match when pattern does not match', async () => {
    await luaEngine.execute(`
      createAlias("^greet (\\\\w+)$", function(matches)
        send("say Hello, " .. matches[1] .. "!")
      end, { type = "regex" })
    `);

    // Process non-matching input
    const matched = await aliasManager.processInput('hello world');

    // Should not match
    expect(matched).toBe(false);
    expect(sentCommands).toHaveLength(0);
  });

  test('regex alias anchors work correctly', async () => {
    await luaEngine.execute(`
      createAlias("^test$", function()
        send("exact match")
      end, { type = "regex" })
    `);

    // Exact match should work
    let matched = await aliasManager.processInput('test');
    expect(matched).toBe(true);
    expect(sentCommands).toContain('exact match');

    // Reset
    sentCommands = [];

    // With extra text should not match
    matched = await aliasManager.processInput('test extra');
    expect(matched).toBe(false);
    expect(sentCommands).toHaveLength(0);
  });

  test('disabled alias does not match', async () => {
    await luaEngine.execute(`
      createAlias("test", function()
        send("should not execute")
      end, { enabled = false })
    `);

    const matched = await aliasManager.processInput('test');

    expect(matched).toBe(false);
    expect(sentCommands).toHaveLength(0);
  });

  test('multiple aliases - first match wins', async () => {
    await luaEngine.execute(`
      createAlias("test", function()
        send("first alias")
      end)

      createAlias("test", function()
        send("second alias")
      end)
    `);

    const matched = await aliasManager.processInput('test');

    // Only the first alias should execute
    expect(matched).toBe(true);
    expect(sentCommands).toEqual(['first alias']);
  });

  test('lua error in alias callback is handled gracefully', async () => {
    const errors: string[] = [];
    const errorHandler = (error: Error) => {
      errors.push(error.message);
    };

    await luaEngine.execute(`
      createAlias("test", function(matches)
        -- This will error because matches is an empty table, not nil
        -- but trying to do math on it will fail
        local x = matches + 1
      end)
    `);

    const matched = await aliasManager.processInput('test', errorHandler);

    // Alias should match
    expect(matched).toBe(true);
    // Error should be caught and passed to handler
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('attempt');
  });

  test('accessing non-existent capture group returns nil not error', async () => {
    await luaEngine.execute(`
      createAlias("test", function(matches)
        -- matches is now always a table (even if empty for literal matches)
        -- accessing non-existent index returns nil, which is fine
        local name = matches[2] or "default"  -- No captures, so nil
        send("Hello, " .. name)
      end)
    `);

    const matched = await aliasManager.processInput('test');

    expect(matched).toBe(true);
    expect(sentCommands).toContain('Hello, default');
  });

  test('matches[1] contains full matched string', async () => {
    await luaEngine.execute(`
      createAlias("^greet (\\\\w+)$", function(matches)
        local fullMatch = matches[1]  -- Should be "greet jed"
        local name = matches[2]       -- Should be "jed"
        echo("Full: " .. fullMatch)
        echo("Name: " .. name)
      end, { type = "regex" })
    `);

    const matched = await aliasManager.processInput('greet jed');

    expect(matched).toBe(true);
    expect(echoedMessages).toContain('Full: greet jed');
    expect(echoedMessages).toContain('Name: jed');
  });
});
