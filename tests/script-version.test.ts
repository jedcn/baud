import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LuaEngine } from '../src/scripting/LuaEngine';

// scriptVersion exists so a script can write the commit it was loaded from into
// the session log. Wasmoon's Lua can neither read .git nor run git itself.
describe('scriptVersion', () => {
  let luaEngine: LuaEngine;
  let echoed: string[];
  let repo: string;
  let notRepo: string;

  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      encoding: 'utf-8',
    }).trim();

  beforeEach(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'baud-version-'));
    notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'baud-noversion-'));
    git('init', '-q');
    fs.writeFileSync(path.join(repo, 'main.lua'), 'echo("v1")\n');
    git('add', 'main.lua');
    git('commit', '-q', '-m', 'first');

    echoed = [];
    luaEngine = new LuaEngine({
      send: () => {},
      echo: (text: string) => {
        echoed.push(text);
      },
      createTrigger: () => '',
      createOutboundTrigger: () => '',
      createAlias: () => '',
      createTimer: () => '',
      getTimers: () => [],
      getAliases: () => [],
      getTriggers: () => [],
      getOutboundTriggers: () => [],
      removeTimer: () => false,
      enableTimer: () => {},
      disableTimer: () => {},
      setStatus: () => {},
      cecho: () => {},
    });
    await luaEngine.initialize();
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(notRepo, { recursive: true, force: true });
  });

  const versionOf = async (dir: string) => {
    await luaEngine.execute(`echo(tostring(scriptVersion(${JSON.stringify(dir)})))`);
    return echoed.pop();
  };

  test('gives the short SHA of a clean checkout', async () => {
    expect(await versionOf(repo)).toBe(git('rev-parse', '--short', 'HEAD'));
  });

  test('marks uncommitted changes to tracked files', async () => {
    fs.writeFileSync(path.join(repo, 'main.lua'), 'echo("v2")\n');
    expect(await versionOf(repo)).toBe(`${git('rev-parse', '--short', 'HEAD')}-dirty`);
  });

  test('ignores untracked files', async () => {
    fs.writeFileSync(path.join(repo, 'scratch.txt'), 'notes\n');
    expect(await versionOf(repo)).toBe(git('rev-parse', '--short', 'HEAD'));
  });

  test('reads the commit at call time, so a reload after a commit sees it', async () => {
    const before = await versionOf(repo);
    fs.writeFileSync(path.join(repo, 'main.lua'), 'echo("v2")\n');
    git('commit', '-q', '-am', 'second');
    const after = await versionOf(repo);
    expect(after).toBe(git('rev-parse', '--short', 'HEAD'));
    expect(after).not.toBe(before);
  });

  test('is Lua nil outside a git checkout', async () => {
    await luaEngine.execute(`
      local v = scriptVersion(${JSON.stringify(notRepo)})
      echo(type(v) .. "/" .. tostring(v ~= nil))
    `);
    expect(echoed).toEqual(['nil/false']);
  });

  test('defaults to the directory of the script being loaded', async () => {
    const file = path.join(repo, 'main.lua');
    await luaEngine.loadFile('echo(tostring(scriptVersion()))', file);
    expect(echoed).toEqual([git('rev-parse', '--short', 'HEAD')]);
  });
});
