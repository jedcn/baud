import { test, expect, describe, beforeEach } from 'bun:test';
import { LuaEngine } from '../src/scripting/LuaEngine';
import { TriggerManager } from '../src/triggers/TriggerManager';
import { createLuaHttpApi } from '../src/http/luaHttp';
import type { HttpClient, HttpOptions, HttpResult } from '../src/http/HttpClient';

// Flush pending microtasks/timers so fire-and-forget HTTP callbacks run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Lua HTTP API', () => {
  let luaEngine: LuaEngine;
  let triggerManager: TriggerManager;
  let echoedMessages: string[];
  let httpCalls: Array<{ url: string; options?: HttpOptions }>;
  let nextResult: HttpResult;

  beforeEach(async () => {
    echoedMessages = [];
    httpCalls = [];
    nextResult = { ok: true, status: 200, body: 'OK' };

    triggerManager = new TriggerManager();

    const fakeClient = {
      request(url: string, options?: HttpOptions): Promise<HttpResult> {
        httpCalls.push({ url, options });
        return Promise.resolve(nextResult);
      },
    } as unknown as HttpClient;

    const httpApi = createLuaHttpApi(fakeClient, (e) => {
      echoedMessages.push(`error: ${e.message}`);
    });

    luaEngine = new LuaEngine({
      send: () => {},
      echo: (text: string) => {
        echoedMessages.push(text);
      },
      createTrigger: (pattern: string, callback: any, options?: any) => {
        return triggerManager.createTrigger(pattern, callback, options);
      },
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
      cechoBg: () => {},
      httpRequest: httpApi.httpRequest,
      httpGet: httpApi.httpGet,
      httpPost: httpApi.httpPost,
    } as any);

    await luaEngine.initialize();
  });

  test('httpPost issues a POST with the body (fire-and-forget)', async () => {
    await luaEngine.execute(`httpPost("https://ntfy.sh/s5bbs-tele-arena-j5", "Hi")`);
    await flush();

    expect(httpCalls).toEqual([
      { url: 'https://ntfy.sh/s5bbs-tele-arena-j5', options: { method: 'POST', body: 'Hi' } },
    ]);
    expect(echoedMessages).toEqual([]);
  });

  test('httpGet delivers the result table to a Lua callback', async () => {
    nextResult = { ok: true, status: 201, body: '{"id":"abc"}' };
    await luaEngine.execute(`
      httpGet("https://example.com/status", function(res)
        echo(res.status .. " " .. res.body)
        if res.ok then echo("ok!") end
      end)
    `);
    await flush();

    expect(httpCalls[0]).toEqual({ url: 'https://example.com/status', options: { method: 'GET' } });
    expect(echoedMessages).toContain('201 {"id":"abc"}');
    expect(echoedMessages).toContain('ok!');
  });

  test('a trigger callback can fire an HTTP request', async () => {
    await luaEngine.execute(`
      createTrigger("your turn", function()
        httpPost("https://ntfy.sh/topic", "It's your turn!")
      end)
    `);
    await triggerManager.processLine("It's your turn");
    await flush();

    expect(httpCalls).toEqual([
      { url: 'https://ntfy.sh/topic', options: { method: 'POST', body: "It's your turn!" } },
    ]);
  });

  test('httpRequest passes method and headers from an options table', async () => {
    await luaEngine.execute(`
      httpRequest("https://ntfy.sh/topic", {
        method = "POST",
        headers = { Title = "Tele Arena", Priority = "high" },
        body = "You're up!",
      })
    `);
    await flush();

    expect(httpCalls[0].url).toBe('https://ntfy.sh/topic');
    expect(httpCalls[0].options?.method).toBe('POST');
    expect(httpCalls[0].options?.body).toBe("You're up!");
    expect(httpCalls[0].options?.headers).toEqual({ Title: 'Tele Arena', Priority: 'high' });
  });

  test('a failed request surfaces ok=false and an error string to the callback', async () => {
    nextResult = { ok: false, status: 0, body: '', error: 'ENOTFOUND' };
    await luaEngine.execute(`
      httpGet("https://nonexistent.invalid", function(res)
        echo(tostring(res.ok) .. " " .. tostring(res.error))
      end)
    `);
    await flush();

    expect(echoedMessages).toContain('false ENOTFOUND');
  });
});
