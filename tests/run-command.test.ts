import { beforeEach, describe, expect, test } from 'bun:test';
import { AliasManager } from '../src/aliases/AliasManager';
import { splitCommandChain } from '../src/input/splitCommandChain';
import { LuaEngine } from '../src/scripting/LuaEngine';

// send() reaches the socket and nothing else, so a script has no way to run one
// of its own aliases: send("rg 2") arrives at the server as the literal text
// "rg 2" rather than executing the alias's callback. runCommand is the door
// back in -- it takes the path typed input takes.
//
// As in lua-send-logging.test.ts, App is never rendered by the suite, so what
// is covered here is the composition: a runCommand callback wired the way
// App.tsx wires it (aliases first, everything else to the wire) behaves the
// same for a script as the keyboard does for the user.
describe('runCommand', () => {
  let aliasManager: AliasManager;
  let luaEngine: LuaEngine;
  let sentToServer: string[];
  let echoedMessages: string[];

  // runCommand is fire-and-forget -- Lua cannot await a promise, so App.tsx
  // drops it. A test therefore has to let the queued work finish before it
  // asserts on the result.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    aliasManager = new AliasManager();
    sentToServer = [];
    echoedMessages = [];

    // A stand-in for App.tsx's handleSubmit: split on &&, try aliases, fall
    // through to the server.
    const submit = async (text: string) => {
      for (const part of splitCommandChain(text)) {
        const matched = await aliasManager.processInput(part);
        if (!matched) sentToServer.push(part);
      }
    };

    luaEngine = new LuaEngine({
      send: (text: string) => {
        sentToServer.push(text);
      },
      runCommand: (text: string) => {
        void submit(text);
      },
      echo: (text: string) => {
        echoedMessages.push(text);
      },
      createTrigger: () => '',
      createOutboundTrigger: () => '',
      createAlias: (pattern: string, callback: any, options?: any) => {
        return aliasManager.createAlias(pattern, callback, options);
      },
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
    } as any);

    await luaEngine.initialize();
  });

  test('runs a matching alias instead of sending its text', async () => {
    await luaEngine.execute(`
      createAlias("^rg(.*)$", function(matches)
        echo("arena:" .. matches[2])
      end, { type = "regex" })
      runCommand("rg 2")
    `);
    await settle();

    // The alias ran, with its capture, and nothing reached the wire.
    expect(echoedMessages).toEqual(['arena: 2']);
    expect(sentToServer).toEqual([]);
  });

  test('sends text that matches no alias', async () => {
    await luaEngine.execute(`runCommand("st")`);
    await settle();

    expect(sentToServer).toEqual(['st']);
  });

  test('splits a && chain the way typed input is split', async () => {
    await luaEngine.execute(`
      createAlias("^rg(.*)$", function(matches)
        echo("arena:" .. matches[2])
      end, { type = "regex" })
      runCommand("st && rg 2")
    `);
    await settle();

    expect(sentToServer).toEqual(['st']);
    expect(echoedMessages).toEqual(['arena: 2']);
  });
});
