# baud

A terminal-based MUD/BBS client with Lua scripting support, built with TypeScript, Ink, and Bun.

## Features

- **Telnet & SSH connections** - Connect to MUDs and BBSs via telnet or SSH
- **Lua scripting** - Automate with Lua scripts (triggers, aliases, timers)
- **ANSI color support** - Full color terminal output
- **Dynamic UI** - Create gauges, panels, and status bars from Lua
- **Modern architecture** - Built with TypeScript and React (Ink)

## Installation

### 1. Install Bun

Bun is required to run and build this project. Install it using:

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Or using Homebrew (macOS)
brew tap oven-sh/bun
brew install bun
```

After installation, restart your terminal or source your shell configuration:

```bash
source ~/.bashrc  # or ~/.zshrc depending on your shell
```

### 2. Install Dependencies

```bash
bun install
```

## Usage

### Connect to a Server

```bash
bun run src/main.tsx --host <hostname> --port <port>
```

Example:

```bash
# Connect to a local MUD on port 4000
bun run src/main.tsx --host localhost --port 4000

# Connect to a public MUD
bun run src/main.tsx --host aardmud.org --port 23
```

### Help

```bash
bun run src/main.tsx --help
```

## Development

### Project Structure

```
src/
├── main.tsx                 # Entry point, CLI parsing
├── ui/                      # Ink UI components
│   ├── App.tsx             # Root component
│   ├── InputArea.tsx       # Command input
│   ├── OutputArea.tsx      # Server output
│   └── StatusBar.tsx       # Connection status
├── connection/              # Protocol handling
│   ├── ConnectionManager.ts
│   └── TelnetConnection.ts
└── state/                   # State management
    ├── AppState.ts
    └── StateContext.tsx
```

### Running in Development

```bash
bun run dev -- --host localhost --port 4000
```

### Building

Create a standalone executable:

```bash
bun run build
```

This creates `dist/baud` which can be run without installing Node.js or Bun.

### Testing

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Current Status

**Phase 1 Complete** - Basic connectivity and output

- ✅ Project scaffolding (package.json, tsconfig.json, bunfig.toml)
- ✅ Basic Ink UI (StatusBar, OutputArea, InputArea, App)
- ✅ Telnet connection support
- ✅ State management with React Context
- ✅ CLI argument parsing

### Upcoming Features

**Phase 2** - Enhanced Input/Output
- Command history (up/down arrows)
- Line editing (left/right, CTRL-A, CTRL-E)
- ANSI color parsing and rendering

**Phase 3** - Configuration System
- Persistent connection profiles
- JSON configuration files
- Profile management

**Phase 4+** - Lua Scripting, Triggers, Aliases, Timers, SSH, and more

## Controls

- **Type and press Enter** - Send command to server
- **Backspace** - Delete character
- **CTRL-C** - Exit

## License

MIT - See LICENSE file for details

## Author

Jed Northridge
