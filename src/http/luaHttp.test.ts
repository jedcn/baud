import { describe, expect, it } from 'bun:test';
import type { HttpClient, HttpOptions, HttpResult } from './HttpClient.js';
import { createLuaHttpApi } from './luaHttp.js';

// A stand-in HttpClient that records calls and returns a canned result.
function fakeClient(result: HttpResult = { ok: true, status: 200, body: 'OK' }) {
  const calls: Array<{ url: string; options?: HttpOptions }> = [];
  const client = {
    request(url: string, options?: HttpOptions): Promise<HttpResult> {
      calls.push({ url, options });
      return Promise.resolve(result);
    },
  } as unknown as HttpClient;
  return { client, calls };
}

describe('createLuaHttpApi', () => {
  it('httpGet issues a GET and passes the result table to the callback', async () => {
    const { client, calls } = fakeClient({ ok: true, status: 200, body: 'hello' });
    const errors: Error[] = [];
    const api = createLuaHttpApi(client, (e) => errors.push(e));

    let received: HttpResult | undefined;
    await api.httpGet('https://example.com', (res: HttpResult) => {
      received = res;
    });

    expect(calls).toEqual([{ url: 'https://example.com', options: { method: 'GET' } }]);
    expect(received).toEqual({ ok: true, status: 200, body: 'hello' });
    expect(errors).toEqual([]);
  });

  it('httpPost issues a POST with the given body', async () => {
    const { client, calls } = fakeClient();
    const api = createLuaHttpApi(client, () => {});

    await api.httpPost('https://ntfy.sh/topic', 'Hi');

    expect(calls).toEqual([
      { url: 'https://ntfy.sh/topic', options: { method: 'POST', body: 'Hi' } },
    ]);
  });

  it('is fire-and-forget: no callback required', async () => {
    const { client, calls } = fakeClient();
    const errors: Error[] = [];
    const api = createLuaHttpApi(client, (e) => errors.push(e));

    await api.httpPost('https://ntfy.sh/topic', 'Hi');

    expect(calls).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('httpRequest accepts (url, callback) with options omitted', async () => {
    const { client, calls } = fakeClient({ ok: true, status: 204, body: '' });
    const api = createLuaHttpApi(client, () => {});

    let received: HttpResult | undefined;
    await api.httpRequest('https://example.com', (res: HttpResult) => {
      received = res;
    });

    expect(calls).toEqual([{ url: 'https://example.com', options: undefined }]);
    expect(received?.status).toBe(204);
  });

  it('httpRequest passes an options table through', async () => {
    const { client, calls } = fakeClient();
    const api = createLuaHttpApi(client, () => {});

    await api.httpRequest(
      'https://ntfy.sh/topic',
      { method: 'POST', headers: { Title: 'Arena' }, body: 'up' },
      () => {},
    );

    expect(calls[0].options).toEqual({
      method: 'POST',
      headers: { Title: 'Arena' },
      body: 'up',
    });
  });

  it('routes a throwing Lua callback to onError instead of rejecting', async () => {
    const { client } = fakeClient();
    const errors: Error[] = [];
    const api = createLuaHttpApi(client, (e) => errors.push(e));

    await api.httpGet('https://example.com', () => {
      throw new Error('boom in lua');
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('boom in lua');
  });
});
