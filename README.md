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

You can connect directly using `--host` and `--port`, or save connection profiles for reuse.

#### Direct Connection

```bash
bun run src/main.tsx --host <hostname> --port <port>
```

Example:

```bash
# Connect to a local MUD on port 4000
bun run src/main.tsx --host localhost --port 4000

# Connect to a public BBS
bun run src/main.tsx --host bbs.fozztexx.com --port 23
```

#### Using Saved Profiles

Save a connection as a profile for easy reuse:

```bash
# Save a profile while connecting
bun run src/main.tsx --host bbs.example.com --port 23 --save-profile mybbs

# Connect using the saved profile
bun run src/main.tsx --profile mybbs
```

### Help

```bash
bun run src/main.tsx --help
```

## Configuration

Configuration files are stored in platform-specific directories:

- **macOS**: `~/Library/Application Support/baud/`
- **Linux**: `~/.config/baud/`
- **Windows**: `%APPDATA%/baud/`

### Connection Profiles

Profiles are saved in `profiles.json` and can be created in two ways:

1. **Using the `--save-profile` flag** (recommended):
   ```bash
   bun run src/main.tsx --host aardmud.org --port 23 --save-profile aardmud
   ```

2. **Manually editing `profiles.json`**:
   ```json
   {
     "profiles": [
       {
         "id": "aardmud",
         "name": "Aardwolf MUD",
         "protocol": "telnet",
         "host": "aardmud.org",
         "port": 23
       }
     ]
   }
   ```

### Profile Options

Each profile supports the following fields:

- `id` (required) - Unique identifier for the profile
- `name` (required) - Display name for the profile
- `protocol` (required) - Either `"telnet"` or `"ssh"`
- `host` (required) - Server hostname or IP address
- `port` (required) - Server port number
- `username` (optional) - Username for SSH connections
- `password` (optional) - Password for SSH connections
- `privateKey` (optional) - Path to SSH private key file

## Lua Scripting

baud includes a powerful Lua 5.4 scripting engine (via wasmoon) that allows you to automate gameplay, create triggers and aliases, and extend functionality.

### Loading Scripts

Load Lua scripts on startup using the `--script` flag:

```bash
# Load a single script
bun run src/main.tsx --profile myserver --script ./triggers.lua

# Load multiple scripts
bun run src/main.tsx --profile myserver --script ./triggers.lua --script ./ui.lua
```

### Interactive Lua

Execute Lua code interactively using the `/lua` command:

```
/lua echo("Hello from Lua!")
/lua send("look")
/lua x = 5 + 3
/lua echo("Result: " .. x)
```

### Lua API

baud provides the following global functions in Lua scripts:

#### send(text)
Send a command to the server.

```lua
send("look")
send("say Hello, world!")
```

#### echo(text)
Display a message in the output area (visible only to you).

```lua
echo("Script loaded successfully!")
echo("Health: 100/100")
```

#### createTrigger(pattern, callback, options)
Create a trigger that executes a Lua function when server output matches a pattern.

**IMPORTANT:** When using regex patterns, escape backslashes in Lua strings! Use `\\d` not `\d`, and `\\w` not `\w`.

**Capture Groups:** For regex triggers with capture groups:
- `matches[1]` = the full matched string
- `matches[2]` = first capture group
- `matches[3]` = second capture group, etc.

```lua
-- Simple trigger (literal text match)
createTrigger("You have been poisoned!", function()
  send("drink antidote")
  echo("Auto-cured poison!")
end)

-- Regex trigger with capture groups
-- NOTE: Use \\d (double backslash) for JavaScript regex patterns!
createTrigger("^You have (\\d+)/(\\d+) health", function(matches)
  local current = tonumber(matches[2])  -- First capture group
  local max = tonumber(matches[3])      -- Second capture group
  if current < max * 0.3 then
    send("flee")
    echo("Health critical! Fleeing!")
  end
end, { type = "regex" })

-- Gag trigger (hide matching lines)
createTrigger("The shopkeeper yawns.", function()
  -- This line will be hidden from output
end, { gag = true })
```

**Options:**
- `type` - `"literal"` (default) or `"regex"`
- `enabled` - `true` (default) or `false`
- `priority` - Number for execution order (higher = first)
- `gag` - `true` to hide matched lines, `false` (default)

#### createAlias(pattern, callback, options)
Create an alias that executes a Lua function when user input matches a pattern.

**IMPORTANT:** When using regex patterns, escape backslashes in Lua strings! Use `\\d` not `\d`, and `\\w` not `\w`.

**Capture Groups:** For regex aliases with capture groups:
- `matches[1]` = the full matched string
- `matches[2]` = first capture group
- `matches[3]` = second capture group, etc.

```lua
-- Simple alias
createAlias("^gg$", function()
  send("say Good game, everyone!")
end, { type = "regex" })

-- Alias with capture groups
-- NOTE: Use \\w (double backslash) for JavaScript regex patterns!
createAlias("^greet (\\w+)$", function(matches)
  send("say Hello, " .. matches[2] .. "!")  -- First capture group
end, { type = "regex" })

-- Multi-step alias
createAlias("^n(\\d+)$", function(matches)
  local times = tonumber(matches[2])  -- First capture group
  for i = 1, times do
    send("north")
  end
end, { type = "regex" })
```

**Options:**
- `type` - `"literal"` (default) or `"regex"`
- `enabled` - `true` (default) or `false`

### Example Script

Here's a simple example script (`example.lua`):

```lua
-- Display a startup message
echo("My script loaded!")

-- Define a function to greet other players
function greet(name)
  send("say Hello, " .. name .. "!")
  echo("Greeted " .. name)
end

-- Define a function to look around
function look_around()
  send("look")
  echo("Looking around...")
end
```

Load it with:
```bash
bun run src/main.tsx --profile myserver --script ./example.lua
```

Then use it interactively:
```
/lua greet("Alice")
/lua look_around()
```

### Advanced Usage

See `triggers.lua` for a comprehensive example showing:
- Health monitoring with automatic flee
- Message highlighting
- Spam filtering with gag
- Quick aliases for common commands
- Complex aliases with state tracking

### Coming Soon

Future phases will add:
- **Timers** - Schedule Lua functions to run at intervals
- **Dynamic UI** - Create gauges, panels, and status bars from Lua
- **SSH Support** - Connect via SSH in addition to telnet

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

**Phase 2 Complete** - Enhanced Input/Output
- ✅ Command history with up/down arrows and CTRL-P/CTRL-N
- ✅ Line editing (arrow keys, CTRL-A/E/B/F/K/D/U)
- ✅ ANSI color parsing (256-color support)
- ✅ CP437 character encoding for BBS compatibility
- ✅ Auto-exit on disconnect

**Phase 3 Complete** - Configuration System
- ✅ Platform-specific config directories
- ✅ Persistent connection profiles
- ✅ JSON configuration with Zod validation
- ✅ Profile management (save, load, list)

**Phase 4 Complete** - Lua Scripting Foundation
- ✅ Lua 5.4 engine via wasmoon (WebAssembly)
- ✅ Load .lua files with `--script` flag
- ✅ Interactive `/lua` command
- ✅ Global API functions: `send()` and `echo()`
- ✅ Script loading with error reporting

**Phase 5 Complete** - Triggers & Aliases
- ✅ `createTrigger()` - Match server output with literal or regex patterns
- ✅ `createAlias()` - Match user input with literal or regex patterns
- ✅ Capture groups for dynamic pattern matching
- ✅ Trigger options: priority, gag, enabled
- ✅ Pure Lua implementation (no JSON!)
- ✅ Comprehensive example script (triggers.lua)

### Upcoming Features

**Phase 6** - Timers
- Schedule Lua functions to run at intervals
- One-shot and repeating timers

**Phase 7+** - SSH, Dynamic UI, and more

## Controls

### Basic Input
- **Type and press Enter** - Send command to server
- **Backspace** - Delete character before cursor
- **CTRL-C** - Exit

### Command History
- **Up Arrow / CTRL-P** - Navigate to previous command
- **Down Arrow / CTRL-N** - Navigate to next command

### Line Editing
- **Left Arrow / CTRL-B** - Move cursor left
- **Right Arrow / CTRL-F** - Move cursor right
- **CTRL-A** - Move to beginning of line
- **CTRL-E** - Move to end of line
- **CTRL-K** - Delete from cursor to end of line
- **CTRL-D** - Delete character at cursor (forward delete)

## License

MIT - See LICENSE file for details

## Author

Jed Northridge
