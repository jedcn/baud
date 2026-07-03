import { describe, expect, it, spyOn } from 'bun:test';
import { HttpClient } from './HttpClient.js';

describe('HttpClient', () => {
  it('defaults to a GET request', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await client.request('https://example.com');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.com');
    expect(init?.method).toBe('GET');

    fetchSpy.mockRestore();
  });

  it('maps a successful response to { ok, status, body }', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"id":"abc"}', { status: 200 }),
    );

    const result = await client.request('https://example.com');

    expect(result).toEqual({ ok: true, status: 200, body: '{"id":"abc"}' });

    fetchSpy.mockRestore();
  });

  it('reports ok=false for non-2xx responses but still returns the body', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );

    const result = await client.request('https://example.com/missing');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.body).toBe('not found');

    fetchSpy.mockRestore();
  });

  it('passes method, headers, and body through to fetch', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );

    await client.request('https://ntfy.sh/topic', {
      method: 'POST',
      headers: { Title: 'Tele Arena' },
      body: 'Hi',
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://ntfy.sh/topic');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ Title: 'Tele Arena' });
    expect(init?.body).toBe('Hi');

    fetchSpy.mockRestore();
  });

  it('sends a UTF-8 emoji body unchanged', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );

    await client.request('https://ntfy.sh/topic', {
      method: 'POST',
      body: 'This is so cool! 😉',
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.body).toBe('This is so cool! 😉');

    fetchSpy.mockRestore();
  });

  it('resolves a rejected fetch into { ok:false, status:0, error }', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('getaddrinfo ENOTFOUND nonexistent.invalid'),
    );

    const result = await client.request('https://nonexistent.invalid');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.body).toBe('');
    expect(result.error).toContain('ENOTFOUND');

    fetchSpy.mockRestore();
  });

  it('applies a request timeout via an abort signal', async () => {
    const client = new HttpClient();
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );

    await client.request('https://example.com', { timeout: 5000 });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    fetchSpy.mockRestore();
  });
});
