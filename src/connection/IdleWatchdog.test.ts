import { describe, expect, it } from 'bun:test';
import { IdleWatchdog } from './IdleWatchdog.js';

/**
 * Build a watchdog wired to a mutable fake clock. Tests advance `clock.t` and
 * call `watchdog.check()` to simulate the polling timer deterministically.
 */
function makeWatchdog(overrides: Partial<Parameters<typeof buildOptions>[0]> = {}) {
  const clock = { t: 0 };
  const warns: number[] = [];
  const deaths: number[] = [];
  const watchdog = new IdleWatchdog(
    buildOptions({
      warnMs: 1000,
      deadMs: 3000,
      onWarn: (idle) => warns.push(idle),
      onDead: (idle) => deaths.push(idle),
      now: () => clock.t,
      ...overrides,
    }),
  );
  return { clock, warns, deaths, watchdog };
}

function buildOptions(o: {
  warnMs: number;
  deadMs: number;
  onWarn: (idle: number) => void;
  onDead: (idle: number) => void;
  now: () => number;
}) {
  return o;
}

describe('IdleWatchdog', () => {
  it('fires onWarn once when idle crosses the warn threshold', () => {
    const { clock, warns, deaths, watchdog } = makeWatchdog();
    watchdog.start();

    clock.t = 999;
    watchdog.check();
    expect(warns).toHaveLength(0);

    clock.t = 1000;
    watchdog.check();
    expect(warns).toEqual([1000]);

    // Still idle but not yet dead: warn should not repeat.
    clock.t = 2000;
    watchdog.check();
    expect(warns).toHaveLength(1);
    expect(deaths).toHaveLength(0);
  });

  it('fires onDead once when idle crosses the dead threshold', () => {
    const { clock, deaths, watchdog } = makeWatchdog();
    watchdog.start();

    clock.t = 3000;
    watchdog.check();
    expect(deaths).toEqual([3000]);

    // No further deaths even as time marches on.
    clock.t = 10000;
    watchdog.check();
    expect(deaths).toHaveLength(1);
  });

  it('resets the idle clock and re-arms the warning on activity', () => {
    const { clock, warns, deaths, watchdog } = makeWatchdog();
    watchdog.start();

    clock.t = 1500;
    watchdog.check();
    expect(warns).toEqual([1500]);

    // Data arrives — clock resets.
    clock.t = 2000;
    watchdog.notifyActivity();

    // 900ms of new silence: below warn, nothing fires.
    clock.t = 2900;
    watchdog.check();
    expect(warns).toHaveLength(1);

    // Cross the warn threshold again relative to the reset.
    clock.t = 3000;
    watchdog.check();
    expect(warns).toEqual([1500, 1000]);
    expect(deaths).toHaveLength(0);
  });

  it('never lets a healthy connection die if activity keeps arriving', () => {
    const { clock, warns, deaths, watchdog } = makeWatchdog();
    watchdog.start();

    for (let t = 500; t <= 12000; t += 500) {
      clock.t = t;
      watchdog.notifyActivity();
      watchdog.check();
    }

    expect(warns).toHaveLength(0);
    expect(deaths).toHaveLength(0);
  });

  it('is fully disabled when deadMs is 0', () => {
    const { clock, warns, deaths, watchdog } = makeWatchdog({ deadMs: 0 });
    watchdog.start();

    clock.t = 100000;
    watchdog.check();
    expect(warns).toHaveLength(0);
    expect(deaths).toHaveLength(0);
  });

  it('supports a disabled warning while still detecting death', () => {
    const { clock, warns, deaths, watchdog } = makeWatchdog({ warnMs: 0 });
    watchdog.start();

    clock.t = 1500;
    watchdog.check();
    expect(warns).toHaveLength(0);

    clock.t = 3000;
    watchdog.check();
    expect(deaths).toEqual([3000]);
  });

  it('stops firing after stop() is called', () => {
    const { clock, deaths, watchdog } = makeWatchdog();
    watchdog.start();
    watchdog.stop();

    clock.t = 5000;
    watchdog.check();
    expect(deaths).toHaveLength(0);
  });
});
