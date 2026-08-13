import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { TextLogger } from '../src/logging/TextLogger';
import { LuaEngine } from '../src/scripting/LuaEngine';

// A session log used to hold only what the user typed and what the server
// said. Script traffic had to be inferred from the server's echoes of it,
// which is exactly what fails when the script sends something wrong -- a
// rejected menu answer echoes as the server's complaint, not as our send.
//
// This covers the composition (a Lua send reaches both the log and the wire,
// in that order). The wiring in App.tsx that hands the LuaEngine a send
// callback of this shape is not itself exercised: App is never rendered by the
// test suite.
describe('script sends reach the text log', () => {
  const logPath = '/tmp/baud-test-lua-send.log';

  afterEach(() => {
    if (existsSync(logPath)) unlinkSync(logPath);
  });

  async function engineWithLogging(sentToServer: string[]) {
    const textLogger = new TextLogger(logPath);
    const engine = new LuaEngine({
      send: (text: string) => {
        textLogger.logSend(text);
        sentToServer.push(text);
      },
      echo: () => {},
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
    await engine.initialize();
    return engine;
  }

  test('a send from Lua is logged with the same > prefix typed input gets', async () => {
    const sentToServer: string[] = [];
    const engine = await engineWithLogging(sentToServer);

    await engine.execute(`send("n")`);

    expect(readFileSync(logPath, 'utf-8')).toContain('> n\n');
    expect(sentToServer).toEqual(['n']);
  });

  test('logs every send in order, so a doubled answer is visible', async () => {
    const sentToServer: string[] = [];
    const engine = await engineWithLogging(sentToServer);

    // The auto-login bug: the menu answer went out twice, and the log gave no
    // sign of the second one.
    await engine.execute(`send("5") send("5")`);

    const lines = readFileSync(logPath, 'utf-8')
      .split('\n')
      .filter((line) => line.startsWith('> '));
    expect(lines).toEqual(['> 5', '> 5']);
    expect(sentToServer).toEqual(['5', '5']);
  });
});
