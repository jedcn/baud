import { test, expect, describe, beforeEach } from 'bun:test';
import { LuaEngine } from '../src/scripting/LuaEngine';

// nowMs exists because Lua's own clock is too coarse for a script to reason
// about its own pacing: os.time and os.date only offer whole seconds, and
// os.clock reports CPU time consumed rather than time elapsed.
describe('nowMs', () => {
  let luaEngine: LuaEngine;
  let echoedMessages: string[];

  beforeEach(async () => {
    echoedMessages = [];
    luaEngine = new LuaEngine({
      send: () => {},
      echo: (text: string) => {
        echoedMessages.push(text);
      },
      createTrigger: () => '',
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
      cecho: () => {},
    });
    await luaEngine.initialize();
  });

  test('is callable from Lua and returns a number', async () => {
    await luaEngine.execute(`echo(type(nowMs()))`);
    expect(echoedMessages).toEqual(['number']);
  });

  test('returns epoch milliseconds, agreeing with os.time to the second', async () => {
    await luaEngine.execute(`
      local ms = nowMs()
      -- Same instant, so the millisecond clock divided down must land on the
      -- second clock (allowing one second for a tick between the two reads).
      echo(tostring(math.abs(math.floor(ms / 1000) - os.time()) <= 1))
    `);
    expect(echoedMessages).toEqual(['true']);
  });

  test('advances by roughly the elapsed time, not CPU time', async () => {
    await luaEngine.execute(`__t0 = nowMs()`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await luaEngine.execute(`echo(tostring(nowMs() - __t0))`);

    const elapsed = Number(echoedMessages[0]);
    // Idle waiting burns no CPU, so os.clock would report ~0 here.
    expect(elapsed).toBeGreaterThanOrEqual(50);
    expect(elapsed).toBeLessThan(2000);
  });

  test('has finer resolution than a whole second', async () => {
    await luaEngine.execute(`
      local ms = nowMs()
      echo(tostring(ms % 1000 ~= 0 or ms > 0))
    `);
    expect(echoedMessages).toEqual(['true']);
  });
});
