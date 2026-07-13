# baud

A terminal-based MUD/BBS client with Lua scripting support, built with TypeScript, Ink, and Bun.

## Features

- **Telnet** - Connect to MUDs and BBSs via telnet
- **Lua scripting** - Automate with Lua scripts (triggers, aliases, timers)
- **Command chaining** - Send multiple commands in sequence with `&&`
- **ANSI color support** - Full color terminal output
- **Persistent command history** - Commands survive across sessions, with CTRL-R/CTRL-S reverse search
- **Dynamic UI** - Create dynamic text from Lua
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

### Session Logging

baud can log your session to a file in two formats.

**Plain text** (`--log-text`) saves the session as a readable transcript — server output as-is and your sent commands prefixed with `> `. This is what you want for saving off what you see:

```bash
bun run src/main.tsx --profile myserver --log-text ./session.txt
```

The resulting file looks like:

```
# baud text log - started 2026-03-14T12:00:00.000Z

Welcome to the realm, adventurer!
You are standing in a dimly lit tavern.
> look
The tavern is busy with travelers.
> go north
```

**Hex dump** (`--log-bytes`) logs the raw bytes over the wire in both directions with timestamps, useful for debugging protocol issues:

```bash
bun run src/main.tsx --profile myserver --log-bytes ./session.log
```

Both flags can be combined:

```bash
bun run src/main.tsx --profile myserver --log-text ./session.txt --log-bytes ./session.log
```

### Connection Liveness

If a server drops the connection ungracefully — it crashes, the network path
dies, or a firewall/NAT silently evicts the flow — your machine may never
receive a TCP FIN or RST. Without one, baud would sit in `connected` state
forever, waiting on bytes that never arrive; the only recovery was CTRL-C.

baud now guards against this in two ways:

- **TCP keepalive** is enabled on every connection, so the OS probes idle
  sockets and a genuinely dead one eventually surfaces as a normal disconnect.
- **An idle watchdog** measures the gap since the last byte received. After
  `--idle-warn` seconds it shows a visible warning; after `--idle-timeout`
  seconds it prints the reason and **exits with a non-zero status**, so a
  supervisor (a shell `until` loop, systemd, etc.) can restart baud
  automatically instead of you babysitting a hung process.

```bash
# Warn after 60s of silence, treat as dead after 180s
bun run src/main.tsx --profile myserver --idle-warn 60 --idle-timeout 180

# Disable the watchdog entirely
bun run src/main.tsx --profile myserver --idle-timeout 0
```

Defaults: `--idle-warn 120`, `--idle-timeout 300`. Detection is purely
time-based, so set `--idle-timeout` comfortably above the longest silence a
healthy server produces. A minimal supervisor loop:

```bash
until baud --profile myserver; do echo "baud exited, restarting..."; sleep 2; done
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

## Command Chaining

Separate multiple commands with ` && ` to send them in sequence:

```
look && pick up diamond && south
```

Each part goes through the full pipeline — alias resolution, outbound triggers, then sent to the server — in order. The full line is stored as a single history entry.

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

The callback receives two arguments:
- `matches` - A table of match results. For literal triggers, `matches[1]` is the full line. For regex triggers, `matches[1]` is the full match and `matches[2]`, `matches[3]`, etc. are capture groups.
- `context` - A table with metadata about the matched line (optional, backwards compatible with existing triggers that don't use it).

**Context fields:**
- `context.isLastLine` - `true` if this line is the last non-empty line in the received data chunk, meaning the server is likely waiting for input. This is useful for BBS servers that bundle multiple screens into a single TCP packet — a trigger can avoid firing on stale prompts by checking this field.

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

-- Using context.isLastLine to avoid stale prompts
-- Some BBS servers bundle a prompt with the next screen in one packet.
-- Without isLastLine, this trigger would fire even when the server
-- has already moved past the prompt.
createTrigger("^\\(N\\)onstop", function(matches, context)
  if context.isLastLine then
    send("n")
  end
end, { type = "regex" })
```

**Options:**
- `type` - `"literal"` (default) or `"regex"`
- `enabled` - `true` (default) or `false`

> **Note:** The `context` table currently contains only `isLastLine`. Future versions may add additional fields such as `lineIndex` (position of the line within the chunk), `lineCount` (total lines in the chunk), or `rawLine` (the original line with ANSI escape sequences). These would be added in a backwards-compatible way.

#### createOutboundTrigger(pattern, callback, options)
Create a trigger that executes a Lua function when a command is sent to the server. This fires on both programmatic `send()` calls and user-typed commands.

This is useful for tracking what commands are being sent, setting state before server responses arrive, or coordinating between outbound commands and inbound responses.

**IMPORTANT:** When using regex patterns, escape backslashes in Lua strings! Use `\\d` not `\d`.

```lua
-- Track when rotation commands are sent
createOutboundTrigger("^rot (-?\\d+)$", function(matches)
  local amount = tonumber(matches[2])
  if amount == 0 then
    -- "rot 0" is a probe to check current heading
    rotProbe = true
    echo("[Rotation probe sent]")
  else
    -- Actual rotation - will take time
    rotProbe = false
    rotationInProgress = true
    echo("[Rotating by " .. amount .. " degrees]")
  end
end, { type = "regex" })

-- Track scan commands
createOutboundTrigger("^scan planet (\\d+)$", function(matches)
  scanningPlanet = tonumber(matches[2])
  echo("[Scanning planet " .. scanningPlanet .. "]")
end, { type = "regex" })
```

**Options:**
- `type` - `"literal"` (default) or `"regex"`
- `enabled` - `true` (default) or `false`

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

#### createTimer(interval, callback, options)
Create a timer that executes a Lua function at regular intervals.

```lua
-- Basic repeating timer (every 5 seconds)
createTimer(5000, function()
  send("look")
end)

-- One-shot timer (fires once after 10 seconds)
createTimer(10000, function()
  echo("Time's up!")
end, { repeating = false })

-- Named timer (for easier identification)
createTimer(3000, function()
  echo("Tick!")
end, { name = "my ticker" })

-- Disabled timer (won't start until enabled)
createTimer(1000, function()
  send("tick")
end, { enabled = false, name = "paused timer" })
```

**Options:**
- `repeating` - `true` (default) to repeat, `false` for one-shot
- `enabled` - `true` (default) or `false`
- `name` - Optional string to identify the timer

**Returns:** Timer ID (string) for use with other timer functions.

#### getTimers()
Get a list of all timers with their current state.

```lua
local timers = getTimers()
for i, timer in ipairs(timers) do
  echo(string.format("Timer %s: %dms, running=%s",
    timer.name or timer.id,
    timer.interval,
    tostring(timer.running)))
end
```

Each timer object contains:
- `id` - Unique timer identifier
- `interval` - Milliseconds between executions
- `repeating` - Whether timer repeats
- `enabled` - Whether timer is enabled
- `running` - Whether timer is currently active
- `name` - Optional name (if provided)

#### getAliases()
Get a list of all aliases with their current state.

```lua
local aliases = getAliases()
for i, alias in ipairs(aliases) do
  echo(string.format("Alias %s: pattern=%s, type=%s, enabled=%s",
    alias.id, alias.pattern, alias.type, tostring(alias.enabled)))
end
```

Each alias object contains:
- `id` - Unique alias identifier
- `pattern` - The pattern string (literal text or regex)
- `type` - `"literal"` or `"regex"`
- `enabled` - Whether the alias is active

#### getTriggers()
Get a list of all inbound triggers with their current state.

```lua
local triggers = getTriggers()
for i, trigger in ipairs(triggers) do
  echo(string.format("Trigger %s: pattern=%s, type=%s, enabled=%s",
    trigger.id, trigger.pattern, trigger.type, tostring(trigger.enabled)))
end
```

Each trigger object contains:
- `id` - Unique trigger identifier
- `pattern` - The pattern string (literal text or regex)
- `type` - `"literal"` or `"regex"`
- `enabled` - Whether the trigger is active

#### getOutboundTriggers()
Get a list of all outbound triggers with their current state.

```lua
local triggers = getOutboundTriggers()
for i, trigger in ipairs(triggers) do
  echo(string.format("Outbound trigger %s: pattern=%s, type=%s, enabled=%s",
    trigger.id, trigger.pattern, trigger.type, tostring(trigger.enabled)))
end
```

Each outbound trigger object contains:
- `id` - Unique trigger identifier
- `pattern` - The pattern string (literal text or regex)
- `type` - `"literal"` or `"regex"`
- `enabled` - Whether the trigger is active

#### removeTrigger(id)
Remove an inbound trigger by its ID. Useful for one-shot triggers that should
fire only once, then tear themselves down.

```lua
local id
id = createTrigger("You have been summoned!", function()
  echo("Got the summons!")
  removeTrigger(id)  -- fire once, then stop matching
end)
-- Returns true if the trigger was found and removed, false otherwise.
```

#### removeTimer(id)
Stop and remove a timer by its ID.

```lua
local id = createTimer(1000, function() echo("tick") end)
-- Later...
removeTimer(id)  -- Returns true if found and removed
```

#### enableTimer(id)
Enable and start a disabled timer.

```lua
local id = createTimer(1000, function()
  echo("tick")
end, { enabled = false })

-- Later, start the timer
enableTimer(id)
```

#### disableTimer(id)
Stop a running timer without removing it.

```lua
local id = createTimer(1000, function() echo("tick") end)
-- Later, pause the timer
disableTimer(id)
-- Can be restarted with enableTimer(id)
```

#### Timer Examples

**Auto-look timer:** Automatically look around every 30 seconds.

```lua
-- Create a timer that sends "look" every 30 seconds
createTimer(30000, function()
  send("look")
end, { name = "auto-look" })
```

**Buff reminder:** Remind yourself to recast buffs.

```lua
-- Remind to recast shield spell every 5 minutes
createTimer(300000, function()
  echo("*** Time to recast shield! ***")
end, { name = "shield-reminder" })
```

**Pause and resume:** Control timers interactively.

```lua
-- In a script, create a timer and store its ID globally
autoAttackTimer = createTimer(2000, function()
  send("attack")
end, { name = "auto-attack" })

-- Later, from /lua command, pause it:
-- /lua disableTimer(autoAttackTimer)

-- Resume it:
-- /lua enableTimer(autoAttackTimer)

-- Or remove it entirely:
-- /lua removeTimer(autoAttackTimer)
```

**One-shot delay:** Execute something once after a delay.

```lua
-- Wait 5 seconds then send a command
createTimer(5000, function()
  send("say I'm back!")
  echo("Announced return")
end, { repeating = false, name = "announce-return" })
```

**List and manage timers:** See what's running.

```lua
-- View all active timers (from /lua)
-- /lua getTimers()

-- Remove all timers by iterating
for i, timer in ipairs(getTimers()) do
  removeTimer(timer.id)
end
echo("All timers removed")
```

#### httpRequest(url, options, callback)
Make an outbound HTTP(S) request. Requests run in the background and never block
the UI. Provide a `callback` to inspect the response, or omit it entirely for
"fire-and-forget" (e.g. sending a notification). Network errors are delivered to
the callback as a result with `ok = false`; they never crash a script.

The `callback` receives a result table:
- `res.ok` — `true` when the HTTP status is 2xx
- `res.status` — HTTP status code (`0` on a network failure)
- `res.body` — response body as a string
- `res.error` — error message (only present on network failures)

**Options:**
- `method` — HTTP method (default `"GET"`)
- `headers` — table of request headers, e.g. `{ ["Content-Type"] = "application/json" }`
- `body` — request body string
- `timeout` — request timeout in milliseconds (default `10000`)

```lua
httpRequest("https://api.example.com/status", { method = "GET" }, function(res)
  if res.ok then
    echo("Status: " .. res.body)
  else
    echo("Request failed: " .. tostring(res.error))
  end
end)
```

`httpRequest(url, callback)` is also accepted when you don't need options.

#### httpGet(url, callback)
Convenience for a GET request. The `callback` is optional.

```lua
httpGet("https://api.example.com/motd", function(res)
  echo(res.body)
end)
```

#### httpPost(url, body, callback)
Convenience for a POST request with a string body. The `callback` is optional.

**Push a phone notification with [ntfy.sh](https://ntfy.sh):** subscribe to a
topic in the ntfy app, then have a trigger notify you when it fires. This is the
equivalent of `curl -d "message" https://ntfy.sh/<topic>`.

```lua
-- Fire-and-forget: ping your phone when it's your turn
createTrigger("It is your turn", function()
  httpPost("https://ntfy.sh/my-secret-topic", "Your turn in Tele Arena!")
end)
```

ntfy notification options (title, priority, tags/emoji) are set via headers, so
use `httpRequest` when you want them:

```lua
httpRequest("https://ntfy.sh/my-secret-topic", {
  method = "POST",
  headers = { Title = "Tele Arena", Priority = "high", Tags = "crossed_swords" },
  body = "Your turn!",
})
```

**IMPORTANT:** Scripts loaded with `--script` can reach any URL. Only run scripts
you trust.

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
- Quick aliases for common commands
- Complex aliases with state tracking

### Coming Soon

Future phases will add:
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
- ✅ Command history with up/down arrows and CTRL-P/CTRL-N (persists across sessions)
- ✅ Reverse/forward history search with CTRL-R/CTRL-S
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
- ✅ `removeTrigger()` - Remove an inbound trigger by ID
- ✅ Capture groups for dynamic pattern matching
- ✅ Trigger options: enabled
- ✅ Pure Lua implementation (no JSON!)
- ✅ Comprehensive example script (triggers.lua)

**Phase 6 Complete** - Timers
- ✅ `createTimer()` - Schedule Lua functions to run at intervals
- ✅ One-shot and repeating timers
- ✅ `getTimers()` - List all timers with state
- ✅ `removeTimer()` - Stop and remove timers
- ✅ `enableTimer()` / `disableTimer()` - Control timer execution

**Phase 7 Complete** - HTTP Requests
- ✅ `httpRequest()` - Make GET/POST/etc. requests with headers and body
- ✅ `httpGet()` / `httpPost()` - Convenience helpers
- ✅ Non-blocking, fire-and-forget or callback with `{ ok, status, body }`
- ✅ Push phone notifications from triggers (e.g. ntfy.sh)

### Upcoming Features

**Phase 8+** - SSH, Dynamic UI, and more

## Controls

### Basic Input
- **Type and press Enter** - Send command to server
- **`cmd1 && cmd2`** - Send multiple commands in sequence
- **Backspace** - Delete character before cursor
- **CTRL-L** - Clear screen
- **CTRL-C** - Exit

### Command History
- **Up Arrow / CTRL-P** - Navigate to previous command
- **Down Arrow / CTRL-N** - Navigate to next command
- **CTRL-R** - Reverse search through history (type to search, CTRL-R for older match, CTRL-S for newer match, Enter to accept, ESC to cancel)
- **CTRL-S** - Forward search through history (same controls as CTRL-R)

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
