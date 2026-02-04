import { describe, expect, it } from 'bun:test';
import { evaluateStatusFn } from '../src/ui/evaluateStatusFn';

describe('evaluateStatusFn', () => {
  it('returns segments from a function that returns an array', () => {
    const fn = () => [
      { text: 'HP: 100', fg: 'green' },
      { text: 'MP: 50', fg: 'blue' },
    ];

    const segments = evaluateStatusFn(fn);

    expect(segments).toEqual([
      { text: 'HP: 100', fg: 'green' },
      { text: 'MP: 50', fg: 'blue' },
    ]);
  });

  it('displays error message in red when function throws', () => {
    const fn = () => {
      throw new Error('hp is nil');
    };

    const segments = evaluateStatusFn(fn);

    expect(segments).toEqual([{ text: 'hp is nil', fg: 'red' }]);
  });

  it('displays non-Error throws as string', () => {
    const fn = () => {
      throw 'something went wrong';
    };

    const segments = evaluateStatusFn(fn);

    expect(segments).toEqual([{ text: 'something went wrong', fg: 'red' }]);
  });

  it('returns empty array when function returns non-array', () => {
    const fn = () => 'not an array';

    const segments = evaluateStatusFn(fn);

    expect(segments).toEqual([]);
  });

  it('coerces segment text to string', () => {
    const fn = () => [{ text: 42 }];

    const segments = evaluateStatusFn(fn);

    expect(segments).toEqual([{ text: '42', fg: undefined }]);
  });
});
