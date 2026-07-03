export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResult {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

const DEFAULT_TIMEOUT = 10000;

export class HttpClient {
  async request(url: string, options?: HttpOptions): Promise<HttpResult> {
    const method = options?.method ?? 'GET';
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    try {
      const response = await fetch(url, {
        method,
        headers: options?.headers,
        body: options?.body,
        signal: AbortSignal.timeout(timeout),
      });
      const body = await response.text();
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, status: 0, body: '', error: message };
    }
  }
}
