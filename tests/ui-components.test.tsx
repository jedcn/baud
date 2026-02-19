import React from 'react';
import { afterEach, describe, expect, it } from 'bun:test';
import { render } from 'ink-testing-library';
import { StateProvider } from '../src/state/StateContext.js';
import { InputArea } from '../src/ui/InputArea.js';
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

describe('InputArea', () => {
  afterEach(() => {
    delete process.env.BAUD_DISPLAY_ON_PROMPT;
  });

  it('renders prompt without env label by default', () => {
    delete process.env.BAUD_DISPLAY_ON_PROMPT;
    const { lastFrame } = render(
      <StateProvider>
        <InputArea onSubmit={() => {}} />
      </StateProvider>
    );
    expect(lastFrame()).toContain('>');
  });

  it('renders BAUD_DISPLAY_ON_PROMPT value before prompt when set', () => {
    process.env.BAUD_DISPLAY_ON_PROMPT = 'my-workspace';
    const { lastFrame } = render(
      <StateProvider>
        <InputArea onSubmit={() => {}} />
      </StateProvider>
    );
    expect(lastFrame()).toContain('my-workspace');
    expect(lastFrame()).toContain('>');
  });
});
