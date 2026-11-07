import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The commit a directory's git checkout is at: the short SHA, with "-dirty"
 * when tracked files have uncommitted changes. Untracked files don't count, so
 * a stray scratch file doesn't mark a clean checkout dirty. Undefined when the
 * directory isn't in a git checkout or git can't be run.
 */
export function gitVersion(dir: string): string | undefined {
  const git = (args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const sha = git(['rev-parse', '--short', 'HEAD']);
    if (!sha) return undefined;
    const dirty = git(['status', '--porcelain', '--untracked-files=no']) !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return undefined;
  }
}

/**
 * The commit baud itself is running, read once as baud starts. Unlike the
 * scripts, baud's code is loaded once and never reloaded, so what matters is
 * what was checked out at startup: a branch switched while baud runs must not
 * change the answer. Baud runs from its source checkout (`bun run
 * src/main.tsx`), which is what makes git available to ask.
 */
export const BAUD_VERSION = gitVersion(path.dirname(fileURLToPath(import.meta.url)));
