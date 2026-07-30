import React from 'react';
import { afterEach, describe, expect, it } from 'bun:test';
import { render } from 'ink-testing-library';
import { StateProvider, useAppState } from '../src/state/StateContext.js';
import type { AppAction, ConnectionProfile, StatusSegment } from '../src/state/AppState.js';
import { InputArea } from '../src/ui/InputArea.js';
import { OutputArea } from '../src/ui/OutputArea.js';
import { StatusArea } from '../src/ui/StatusArea.js';

// Pushes segments into the shared state so StatusArea renders them, since
// StateProvider always starts from the default (empty) state.
function SeedSegments({ segments }: { segments: StatusSegment[] }) {
  const { dispatch } = useAppState();
  React.useEffect(() => {
    dispatch({ type: 'SET_STATUS_SEGMENTS', segments });
  }, []);
  return null;
}

// Pushes connection actions into the shared state so StatusArea renders the
// default (non-Lua) status line for a given point in a connection's life.
function SeedConnection({ actions }: { actions: AppAction[] }) {
  const { dispatch } = useAppState();
  React.useEffect(() => {
    for (const action of actions) dispatch(action);
  }, []);
  return null;
}

const testProfile: ConnectionProfile = {
  id: 'sat5',
  name: 'sat5',
  protocol: 'telnet',
  host: 'bbs.saturn5bbs.com',
  port: 23,
};

// Let the seeding effect commit and the frame re-render before asserting.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('UI components render without errors', () => {
  it('OutputArea renders', () => {
    const { lastFrame } = render(
      <OutputArea lines={[]} generation={0} />
    );
    expect(lastFrame()).toBeDefined();
  });

  it('StatusArea renders default connection status', () => {
    const { lastFrame } = render(
      <StateProvider>
        <StatusArea />
      </StateProvider>
    );
    expect(lastFrame()).toContain('Disconnected');
  });

  it('StatusArea separates ordinary segments with a space', async () => {
    const { lastFrame } = render(
      <StateProvider>
        <SeedSegments segments={[{ text: 'XP:' }, { text: '(184,893)' }]} />
        <StatusArea />
      </StateProvider>
    );
    await tick();
    expect(lastFrame()).toContain('XP: (184,893)');
  });

  it('StatusArea renders a glued segment flush against the previous one', async () => {
    const { lastFrame } = render(
      <StateProvider>
        <SeedSegments
          segments={[
            { text: 'XP:' },
            { text: '(184,893)', fg: 'cyan' },
            { text: '^', fg: 'red', glue: true },
            { text: 'Status:' },
          ]}
        />
        <StatusArea />
      </StateProvider>
    );
    await tick();
    expect(lastFrame()).toContain('XP: (184,893)^ Status:');
  });

  it('StatusArea names the host it is connecting to', async () => {
    const { lastFrame } = render(
      <StateProvider>
        <SeedConnection actions={[{ type: 'CONNECTION_STARTED', profile: testProfile }]} />
        <StatusArea />
      </StateProvider>
    );
    await tick();
    expect(lastFrame()).toContain('Connecting to bbs.saturn5bbs.com:23...');
    expect(lastFrame()).not.toContain('undefined');
  });

  it('StatusArea names the host and reason when a connection fails', async () => {
    const { lastFrame } = render(
      <StateProvider>
        <SeedConnection
          actions={[
            { type: 'CONNECTION_STARTED', profile: testProfile },
            { type: 'CONNECTION_STATUS_CHANGED', status: 'error', error: 'Operation timed out' },
          ]}
        />
        <StatusArea />
      </StateProvider>
    );
    await tick();
    expect(lastFrame()).toContain(
      'Connection error (bbs.saturn5bbs.com:23): Operation timed out'
    );
  });

  it('StatusArea reports why a live connection dropped', async () => {
    const { lastFrame } = render(
      <StateProvider>
        <SeedConnection
          actions={[
            { type: 'CONNECTION_STARTED', profile: testProfile },
            {
              type: 'CONNECTION_STATUS_CHANGED',
              status: 'disconnected',
              error: 'Connection reset by peer',
            },
          ]}
        />
        <StatusArea />
      </StateProvider>
    );
    await tick();
    expect(lastFrame()).toContain('Disconnected: Connection reset by peer');
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
