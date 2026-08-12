import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { LuaEngine } from '../src/scripting/LuaEngine';

// getenv exists because Lua's own os.getenv cannot see the host environment:
// wasmoon runs Lua as WASM, so os.getenv reads emscripten's sandbox instead of
// the process baud was launched with. Scripts need it to be told things at
// startup -- which character to log in as, which machine they are running on.
describe('getenv', () => {
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

  afterEach(() => {
    // delete, not `= undefined`: assigning undefined to process.env stores the
    // *string* "undefined", which would leave the variable set for the next
    // test rather than unset -- exactly the distinction under test here.
    // biome-ignore lint/performance/noDelete: assignment cannot unset an env var
    delete process.env.BAUD_TEST_VAR;
    // biome-ignore lint/performance/noDelete: assignment cannot unset an env var
    delete process.env.BAUD_TEST_EMPTY;
  });

  test('reads a variable from the host process environment', async () => {
    process.env.BAUD_TEST_VAR = 'kerhak';
    await luaEngine.execute(`echo(getenv("BAUD_TEST_VAR"))`);
    expect(echoedMessages).toEqual(['kerhak']);
  });

  test('returns Lua nil for an unset variable, not a truthy userdata', async () => {
    // wasmoon marshals JS null to a *truthy* Lua userdata, so `if getenv(x)`
    // would be true for every unset variable if the JS side returned null.
    await luaEngine.execute(`
      local v = getenv("BAUD_DEFINITELY_NOT_SET")
      echo(type(v) .. "/" .. tostring(v ~= nil))
    `);
    expect(echoedMessages).toEqual(['nil/false']);
  });

  test('supports the "or default" idiom scripts will use', async () => {
    await luaEngine.execute(`echo(getenv("BAUD_DEFINITELY_NOT_SET") or "fallback")`);
    expect(echoedMessages).toEqual(['fallback']);
  });

  test('reflects changes made after the engine was initialized', async () => {
    // The engine is long-lived and reloadScript() does not restart it, so
    // getenv must read process.env at call time rather than snapshot it.
    await luaEngine.execute(`echo(tostring(getenv("BAUD_TEST_VAR")))`);
    process.env.BAUD_TEST_VAR = 'johnsonite';
    await luaEngine.execute(`echo(tostring(getenv("BAUD_TEST_VAR")))`);
    expect(echoedMessages).toEqual(['nil', 'johnsonite']);
  });

  test('distinguishes an empty variable from an unset one', async () => {
    process.env.BAUD_TEST_EMPTY = '';
    await luaEngine.execute(`
      echo(type(getenv("BAUD_TEST_EMPTY")) .. "/" .. type(getenv("BAUD_TEST_UNSET")))
    `);
    expect(echoedMessages).toEqual(['string/nil']);
  });
});
