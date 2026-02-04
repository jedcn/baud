import type { StatusSegment } from '../state/AppState.js';

export function evaluateStatusFn(fn: () => any): StatusSegment[] {
  try {
    const result = fn();
    if (Array.isArray(result)) {
      return result.map((s: any) => ({
        text: String(s.text ?? ''),
        fg: s.fg,
      }));
    }
    return [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return [{ text: message, fg: 'red' }];
  }
}
