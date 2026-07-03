# Contributing to baud

Thanks for your interest in improving baud! This guide covers the basics of
working on the project.

## Prerequisites

baud is built with [Bun](https://bun.sh). Install it first:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then install dependencies:

```bash
bun install
```

## Development workflow

```bash
# Run the app against a server
bun run dev -- --host localhost --port 4000

# Run the test suite
bun test

# Run tests in watch mode
bun test --watch

# Build the standalone executable (dist/baud)
bun run build
```

## Code style and linting

Formatting and linting are enforced by [Biome](https://biomejs.dev), configured
in `biome.json` (2-space indentation, single quotes, semicolons).

```bash
# Check formatting and lint rules
bun run lint

# Auto-format the codebase
bun run format
```

Please run `bun run lint` before opening a pull request. If you need to make a
deliberate exception to a lint rule, prefer an inline `// biome-ignore <rule>:
<reason>` comment (with a real reason) over disabling the rule globally.

## Tests

New code should come with tests. baud uses Bun's built-in test runner
(`bun:test`); see the existing files under `tests/` and alongside source files
(`*.test.ts`) for the patterns used — most tests drive real behavior through a
manager or a small mock rather than heavy mocking.

## Pull requests

1. Branch off `main`.
2. Make your change with accompanying tests.
3. Ensure `bun run lint` and `bun test` both pass locally.
4. Open a pull request.

Continuous integration (`.github/workflows/ci.yml`) runs `bun run lint` and
`bun test` on every pull request, so both must be green to merge.
