import { test, expect, describe, beforeEach } from 'bun:test';
import { OutboundTriggerManager } from '../src/triggers/OutboundTriggerManager';
import { LuaEngine } from '../src/scripting/LuaEngine';
import { TriggerManager } from '../src/triggers/TriggerManager';

describe('Outbound Triggers', () => {
  let outboundTriggerManager: OutboundTriggerManager;
  let triggerManager: TriggerManager;
  let luaEngine: LuaEngine;
  let sentCommands: string[];
  let echoedMessages: string[];

  beforeEach(async () => {
    // Reset captured output
    sentCommands = [];
    echoedMessages = [];

    // Create managers
    outboundTriggerManager = new OutboundTriggerManager();
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
      createOutboundTrigger: (pattern: string, callback: any, options?: any) => {
        return outboundTriggerManager.createOutboundTrigger(pattern, callback, options);
      },
      createAlias: () => '',
      createTimer: () => '',
      getTimers: () => [],
      getAliases: () => [],
      getTriggers: () => [],
      getOutboundTriggers: () => {
        return outboundTriggerManager.getOutboundTriggers().map((t) => ({
          id: t.id,
          pattern: t.pattern,
          type: t.type,
          enabled: t.enabled,
        }));
      },
      removeTimer: () => false,
      enableTimer: () => {},
      disableTimer: () => {},
      setStatus: () => {},
      cecho: (color: string, text: string) => {
        echoedMessages.push(`[${color}]${text}`);
      },
      reloadScript: async () => {},
    });

    await luaEngine.initialize();
  });

  test('outbound trigger fires on matching command', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("^rot", function()
        echo("Rotation command detected!")
      end, { type = "regex" })
    `);

    // Process outgoing command
    await outboundTriggerManager.processCommand('rot 45');

    // Verify
    expect(echoedMessages).toContain('Rotation command detected!');
  });

  test('outbound trigger does not fire on non-matching command', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("^rot", function()
        echo("Should not see this")
      end, { type = "regex" })
    `);

    // Process non-matching command
    await outboundTriggerManager.processCommand('warp 5');

    // Verify
    expect(echoedMessages).toHaveLength(0);
  });

  test('outbound trigger captures regex groups', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("^rot (-?\\\\d+)$", function(matches)
        local amount = matches[2]
        echo("Rotating by: " .. amount)
      end, { type = "regex" })
    `);

    // Process command with capture
    await outboundTriggerManager.processCommand('rot 45');

    // Verify
    expect(echoedMessages).toContain('Rotating by: 45');
  });

  test('outbound trigger can set state for inbound trigger to use', async () => {
    // This tests the key use case: outbound trigger sets state,
    // inbound trigger reads it
    await luaEngine.execute(`
      rotProbe = false

      createOutboundTrigger("^rot 0$", function()
        rotProbe = true
        echo("Probe sent")
      end, { type = "regex" })

      createOutboundTrigger("^rot (-?[1-9]\\\\d*)$", function(matches)
        rotProbe = false
        echo("Real rotation: " .. matches[2])
      end, { type = "regex" })
    `);

    // Send a probe (rot 0)
    await outboundTriggerManager.processCommand('rot 0');
    expect(echoedMessages).toContain('Probe sent');

    // Check state
    const result1 = await luaEngine.execute('return rotProbe');
    expect(result1.result).toBe(true);

    // Send a real rotation
    echoedMessages = [];
    await outboundTriggerManager.processCommand('rot 45');
    expect(echoedMessages).toContain('Real rotation: 45');

    // Check state changed
    const result2 = await luaEngine.execute('return rotProbe');
    expect(result2.result).toBe(false);
  });

  test('multiple outbound triggers can fire on same command', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("rot", function()
        echo("Trigger 1: contains rot")
      end)

      createOutboundTrigger("^rot", function()
        echo("Trigger 2: starts with rot")
      end, { type = "regex" })
    `);

    // Both triggers should fire
    await outboundTriggerManager.processCommand('rot 45');

    // Verify both executed
    expect(echoedMessages).toContain('Trigger 1: contains rot');
    expect(echoedMessages).toContain('Trigger 2: starts with rot');
  });

  test('disabled outbound trigger does not fire', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("test", function()
        echo("should not execute")
      end, { enabled = false })
    `);

    await outboundTriggerManager.processCommand('test');

    expect(echoedMessages).toHaveLength(0);
  });

  test('clearOutboundTriggers removes all triggers', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("test", function()
        echo("trigger fired")
      end)
    `);

    // Verify trigger works
    await outboundTriggerManager.processCommand('test');
    expect(echoedMessages).toContain('trigger fired');

    // Clear and verify
    echoedMessages = [];
    outboundTriggerManager.clearOutboundTriggers();
    await outboundTriggerManager.processCommand('test');
    expect(echoedMessages).toHaveLength(0);
  });

  test('lua error in outbound trigger callback is handled gracefully', async () => {
    const errors: string[] = [];
    const errorHandler = (error: Error) => {
      errors.push(error.message);
    };

    await luaEngine.execute(`
      createOutboundTrigger("test", function(matches)
        -- This will error
        local x = matches + 1
      end)
    `);

    await outboundTriggerManager.processCommand('test', errorHandler);

    // Error should be caught and passed to handler
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('attempt');
  });

  test('outbound trigger with negative number capture', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("^rot (-?\\\\d+)$", function(matches)
        local amount = tonumber(matches[2])
        if amount < 0 then
          echo("Rotating left")
        else
          echo("Rotating right")
        end
      end, { type = "regex" })
    `);

    await outboundTriggerManager.processCommand('rot -45');
    expect(echoedMessages).toContain('Rotating left');

    echoedMessages = [];
    await outboundTriggerManager.processCommand('rot 45');
    expect(echoedMessages).toContain('Rotating right');
  });

  test('getOutboundTriggers returns outbound trigger info from Lua', async () => {
    await luaEngine.execute(`
      createOutboundTrigger("rot", function()
        echo("Rotation detected")
      end)

      createOutboundTrigger("^warp (\\\\d+)$", function(matches)
        echo("Warping to " .. matches[2])
      end, { type = "regex" })
    `);

    const result = await luaEngine.execute('return getOutboundTriggers()');
    expect(result.success).toBe(true);

    const triggers = result.result as any[];
    expect(triggers).toHaveLength(2);

    expect(triggers[0].pattern).toBe('rot');
    expect(triggers[0].type).toBe('literal');
    expect(triggers[0].enabled).toBe(true);
    expect(triggers[0].id).toBeDefined();

    expect(triggers[1].pattern).toBe('^warp (\\d+)$');
    expect(triggers[1].type).toBe('regex');
    expect(triggers[1].enabled).toBe(true);
  });
});
