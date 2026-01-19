import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { TimerManager } from '../src/timers/TimerManager';
import { LuaEngine } from '../src/scripting/LuaEngine';

describe('Timers', () => {
  let timerManager: TimerManager;
  let luaEngine: LuaEngine;
  let sentCommands: string[];
  let echoedMessages: string[];

  beforeEach(async () => {
    // Reset captured output
    sentCommands = [];
    echoedMessages = [];

    // Create timer manager
    timerManager = new TimerManager();

    // Create Lua engine with mock API
    luaEngine = new LuaEngine({
      send: (text: string) => {
        sentCommands.push(text);
      },
      echo: (text: string) => {
        echoedMessages.push(text);
      },
      createTrigger: () => '',
      createAlias: () => '',
      createTimer: (interval: number, callback: any, options?: any) => {
        return timerManager.createTimer(interval, callback, options);
      },
    });

    await luaEngine.initialize();
  });

  afterEach(() => {
    // Clean up all timers after each test
    timerManager.stopAll();
  });

  test('timer fires after specified interval', async () => {
    await luaEngine.execute(`
      createTimer(50, function()
        echo("Timer fired!")
      end)
    `);

    // Wait for timer to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(echoedMessages).toContain('Timer fired!');
  });

  test('repeating timer fires multiple times', async () => {
    await luaEngine.execute(`
      createTimer(30, function()
        echo("Tick")
      end)
    `);

    // Wait for multiple firings
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have fired at least twice
    const tickCount = echoedMessages.filter((m) => m === 'Tick').length;
    expect(tickCount).toBeGreaterThanOrEqual(2);
  });

  test('one-shot timer fires only once', async () => {
    await luaEngine.execute(`
      createTimer(30, function()
        echo("One shot!")
      end, { repeating = false })
    `);

    // Wait long enough for multiple potential firings
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have fired exactly once
    const count = echoedMessages.filter((m) => m === 'One shot!').length;
    expect(count).toBe(1);
  });

  test('disabled timer does not fire', async () => {
    await luaEngine.execute(`
      createTimer(20, function()
        echo("Should not fire")
      end, { enabled = false })
    `);

    // Wait for potential firing
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(echoedMessages).not.toContain('Should not fire');
  });

  test('timer can be stopped/removed', async () => {
    const result = await luaEngine.execute(`
      return createTimer(20, function()
        echo("Timer tick")
      end)
    `);

    // Let it fire once
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initialCount = echoedMessages.filter((m) => m === 'Timer tick').length;
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Remove the timer
    const timerId = result.result as string;
    timerManager.removeTimer(timerId);

    // Wait and verify no more firings
    const countAfterRemove = echoedMessages.filter((m) => m === 'Timer tick').length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const finalCount = echoedMessages.filter((m) => m === 'Timer tick').length;

    // Count should not have increased
    expect(finalCount).toBe(countAfterRemove);
  });

  test('timer callback can use send/echo', async () => {
    await luaEngine.execute(`
      createTimer(30, function()
        send("look")
        echo("Sent look command")
      end, { repeating = false })
    `);

    // Wait for timer to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sentCommands).toContain('look');
    expect(echoedMessages).toContain('Sent look command');
  });

  test('lua error in timer callback is handled gracefully', async () => {
    const errors: string[] = [];
    timerManager.setErrorHandler((error: Error) => {
      errors.push(error.message);
    });

    await luaEngine.execute(`
      createTimer(30, function()
        -- This will error
        local x = nil + 1
      end, { repeating = false })
    `);

    // Wait for timer to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Error should be caught and passed to handler
    expect(errors.length).toBeGreaterThan(0);
  });

  test('enableTimer starts a stopped timer', async () => {
    const result = await luaEngine.execute(`
      return createTimer(30, function()
        echo("Enabled timer")
      end, { enabled = false })
    `);

    // Verify it hasn't fired
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(echoedMessages).not.toContain('Enabled timer');

    // Enable and wait
    const timerId = result.result as string;
    timerManager.enableTimer(timerId);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(echoedMessages).toContain('Enabled timer');
  });

  test('disableTimer stops a running timer', async () => {
    const result = await luaEngine.execute(`
      return createTimer(20, function()
        echo("Running timer")
      end)
    `);

    // Let it fire at least once
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initialCount = echoedMessages.filter((m) => m === 'Running timer').length;
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Disable the timer
    const timerId = result.result as string;
    timerManager.disableTimer(timerId);

    // Record count after disable
    const countAfterDisable = echoedMessages.filter((m) => m === 'Running timer').length;

    // Wait and verify no more firings
    await new Promise((resolve) => setTimeout(resolve, 50));
    const finalCount = echoedMessages.filter((m) => m === 'Running timer').length;

    // Count should not have increased
    expect(finalCount).toBe(countAfterDisable);
  });

  test('clearTimers stops and removes all timers', async () => {
    await luaEngine.execute(`
      createTimer(20, function() echo("Timer 1") end)
      createTimer(20, function() echo("Timer 2") end)
      createTimer(20, function() echo("Timer 3") end)
    `);

    // Let them fire
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initialCount = echoedMessages.length;
    expect(initialCount).toBeGreaterThan(0);

    // Clear all timers
    timerManager.clearTimers();

    // Record count after clear
    const countAfterClear = echoedMessages.length;

    // Wait and verify no more firings
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Count should not have increased
    expect(echoedMessages.length).toBe(countAfterClear);
    expect(timerManager.getTimers()).toHaveLength(0);
  });

  test('getTimers returns copy of timer array', () => {
    timerManager.createTimer(1000, () => {});
    timerManager.createTimer(2000, () => {});

    const timers = timerManager.getTimers();
    expect(timers).toHaveLength(2);

    // Modifying the returned array should not affect internal state
    timers.pop();
    expect(timerManager.getTimers()).toHaveLength(2);
  });
});
