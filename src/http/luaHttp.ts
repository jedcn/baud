import type { HttpClient } from './HttpClient.js';

export interface LuaHttpApi {
  httpRequest: (url: string, optionsOrCallback?: any, callback?: any) => Promise<void>;
  httpGet: (url: string, callback?: any) => Promise<void>;
  httpPost: (url: string, body: string, callback?: any) => Promise<void>;
}

/**
 * Build the Lua-facing HTTP globals (httpRequest/httpGet/httpPost) around an
 * HttpClient. Requests are fire-and-forget: when a Lua callback is supplied it
 * is invoked with the result table once the request settles, otherwise the
 * result is discarded. Nothing throws into Lua — HttpClient.request() resolves
 * network errors into a result table, and any error raised by the Lua callback
 * itself is routed to onError.
 */
export function createLuaHttpApi(
  client: HttpClient,
  onError: (error: Error) => void,
): LuaHttpApi {
  const run = async (url: string, options: any, cb: any): Promise<void> => {
    try {
      const result = await client.request(url, options);
      if (cb) {
        cb(result);
      }
    } catch (error) {
      // request() swallows network errors into a result, so reaching here means
      // either that contract was broken or the Lua callback threw.
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  return {
    httpRequest(url: string, optionsOrCallback?: any, callback?: any): Promise<void> {
      // Allow httpRequest(url, callback) as well as httpRequest(url, options, callback)
      if (typeof optionsOrCallback === 'function') {
        return run(url, undefined, optionsOrCallback);
      }
      return run(url, optionsOrCallback, callback);
    },
    httpGet(url: string, callback?: any): Promise<void> {
      return run(url, { method: 'GET' }, callback);
    },
    httpPost(url: string, body: string, callback?: any): Promise<void> {
      return run(url, { method: 'POST', body }, callback);
    },
  };
}
