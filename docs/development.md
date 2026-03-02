# Local Development

## Prerequisites

baud requires [Bun](https://bun.sh). Install it with:

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# macOS with Homebrew
brew install oven-sh/bun/bun
```

After installing, restart your terminal or source your shell config:

```bash
source ~/.bashrc   # or ~/.zshrc
```

## Setup

```bash
git clone <repo>
cd baud
bun install
```

## Running in Development

Connect to a server with live reloading:

```bash
bun run dev -- --host localhost --port 4000
bun run dev -- --profile myserver
```

## Building

Create a standalone executable (no Bun or Node.js required to run it):

```bash
bun run build
```

Output: `dist/baud`

## Running Tests

```bash
# Run all tests
bun test

# Watch mode — reruns tests on file changes
bun test --watch

# With coverage
bun test --coverage
```

## Linting

baud uses [Biome](https://biomejs.dev) for formatting and linting:

```bash
bunx biome check src/
bunx biome check --write src/  # auto-fix
```

## Project Structure

```
src/
├── main.tsx                    # Entry point, CLI argument parsing
├── ui/                         # React/Ink terminal UI components
│   ├── App.tsx                 # Root component
│   ├── InputArea.tsx           # Command input with line editing
│   ├── OutputArea.tsx          # Server output display
│   ├── StatusArea.tsx          # Connection status bar
│   └── hooks/                  # Custom React hooks
│       ├── useCommandHistory.ts
│       ├── useLineEditor.ts
│       └── useTabCompletion.ts
├── connection/                 # Telnet protocol handling
│   ├── ConnectionManager.ts
│   ├── TelnetConnection.ts
│   └── ANSIParser.ts
├── scripting/                  # Lua engine and script loading
│   ├── LuaEngine.ts
│   └── ScriptLoader.ts
├── triggers/                   # Inbound and outbound triggers
│   ├── Trigger.ts
│   ├── TriggerManager.ts
│   └── OutboundTriggerManager.ts
├── aliases/                    # Command aliases
│   ├── Alias.ts
│   └── AliasManager.ts
├── timers/                     # Scheduled execution
│   ├── Timer.ts
│   └── TimerManager.ts
├── sound/                      # Audio playback and TTS
│   └── SoundManager.ts
├── config/                     # Configuration and profiles
│   ├── ConfigManager.ts
│   └── schema.ts
├── state/                      # React Context state management
│   ├── AppState.ts
│   └── StateContext.tsx
├── history/                    # Command history persistence
│   └── CommandHistoryManager.ts
├── logging/                    # Session logging
│   └── SessionLogger.ts
└── utils/
    ├── paths.ts                # Platform-specific config paths
    └── cp437.ts                # CP437 encoding for BBS
```

## Configuration Files

baud stores configuration in a platform-specific directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/baud/` |
| Linux | `~/.config/baud/` |
| Windows | `%APPDATA%\baud\` |

Files written there:
- `profiles.json` — Saved connection profiles
- `config.json` — Main configuration
- `history` — Persistent command history
