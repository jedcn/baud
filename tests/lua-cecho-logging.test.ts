import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { TextLogger } from '../src/logging/TextLogger';
import { LuaEngine } from '../src/scripting/LuaEngine';

// `cecho` used to draw a line and log nothing, so a script that coloured its most
// important message thereby lost it. The tele-arena script had been working around
// that for a year -- a death, an armed stop, "did this fire?" -- each written in
// plain `echo` with a comment saying cecho never reaches the log. Colour is how a
// line is displayed, not what it is.
//
// Like lua-send-logging.test.ts, this covers the COMPOSITION -- a cecho callback
// that logs and then draws. The wiring in App.tsx that hands the LuaEngine a
// callback of this shape is not exercised here: App is never rendered by the test
// suite.
describe('a coloured echo reaches the text log', () => {
  const logPath = '/tmp/baud-test-lua-cecho.log';

  afterEach(() => {
    if (existsSync(logPath)) unlinkSync(logPath);
  });

  async function engineWithLogging(drawn: { text: string; color: string }[]) {
    const textLogger = new TextLogger(logPath);
    const engine = new LuaEngine({
      send: () => {},
      echo: (text: string) => {
        textLogger.logRecv(text);
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
      cecho: (color: string, text: string) => {
        textLogger.logRecv(text);
        drawn.push({ text, color });
      },
    });
    await engine.initialize();
    return engine;
  }

  test('the text is logged, and the colour is kept for the screen', async () => {
    const drawn: { text: string; color: string }[] = [];
    const engine = await engineWithLogging(drawn);

    await engine.execute(`cecho("red", "[map] this may be a duplicate")`);

    expect(readFileSync(logPath, 'utf-8')).toContain('[map] this may be a duplicate');
    expect(drawn).toEqual([{ text: '[map] this may be a duplicate', color: 'red' }]);
  });

  test('a coloured line and a plain one land in the log together, in order', async () => {
    const drawn: { text: string; color: string }[] = [];
    const engine = await engineWithLogging(drawn);

    // The case this is for: a warning in red followed by the plain line that
    // says what to do about it. Reading the log afterwards, both have to be
    // there and in that order, or the warning is half a message.
    await engine.execute(`cecho("red", "minting a room that may exist") echo("  map-here it")`);

    const lines = readFileSync(logPath, 'utf-8')
      .split('\n')
      .filter((l) => l.length && !l.startsWith('#'));   // drop the log's own header
    expect(lines).toEqual(['minting a room that may exist', '  map-here it']);
  });
});
