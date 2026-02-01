import React from 'react';
import { describe, expect, it } from 'bun:test';
import { render } from 'ink-testing-library';
import { StateProvider } from '../src/state/StateContext.js';
import { OutputArea } from '../src/ui/OutputArea.js';
import { StatusArea } from '../src/ui/StatusArea.js';

describe('UI components render without errors', () => {
  it('OutputArea renders', () => {
    const { lastFrame } = render(
      <StateProvider>
        <OutputArea />
      </StateProvider>
    );
    expect(lastFrame()).toContain('No output yet');
  });

  it('StatusArea renders default connection status', () => {
    const { lastFrame } = render(
      <StateProvider>
        <StatusArea />
      </StateProvider>
    );
    expect(lastFrame()).toContain('Disconnected');
  });
});
