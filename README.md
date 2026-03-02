# baud

baud is a terminal MUD and BBS client with a Lua scripting engine. Connect to a game, write a few lines of Lua, and baud watches server output, fires triggers, expands aliases, plays sounds, and runs timers — all while you play.

## What it does

**Connect to any MUD or BBS** over telnet. baud renders full ANSI color, handles CP437 character encoding for BBS compatibility, and keeps a persistent command history across sessions.

**Automate with Lua scripts.** Load `.lua` files at startup or run Lua interactively from the client. Scripts have access to the full feature set: send commands, watch for patterns, intercept your input, schedule timers, and play audio.

**Triggers** watch server output and fire when a pattern matches — catch a poison message and auto-cure, detect low health and flee, highlight tells from other players. Both inbound (server → you) and outbound (you → server) triggers are supported.

**Aliases** intercept your input before it goes to the server. Turn `n5` into five `north` commands, expand `gg` into a full farewell message, or add conditional logic based on game state.

**Timers** run Lua on a schedule. Set a 30-second auto-look, a buff reminder every 5 minutes, or a one-shot delay before announcing your return.

**Sounds** play audio files or speak text aloud via text-to-speech, driven from any trigger or timer.

**A live status bar** that your scripts can update with anything — current HP, mana, coordinates, whatever the game exposes.

## Installation

### 1. Install Bun

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# macOS with Homebrew
brew install oven-sh/bun/bun
```

Restart your terminal or source your shell config after installing.

### 2. Install dependencies

```bash
bun install
```

## Connecting

**Direct connection:**

```bash
bun run src/main.tsx --host localhost --port 4000
bun run src/main.tsx --host bbs.fozztexx.com --port 23
```

**Save a profile and reuse it:**

```bash
bun run src/main.tsx --host aardmud.org --port 23 --save-profile aardmud
bun run src/main.tsx --profile aardmud
```

**Load a Lua script on startup:**

```bash
bun run src/main.tsx --profile aardmud --script ./my-triggers.lua
```

**Help:**

```bash
bun run src/main.tsx --help
```

## Lua Scripting

Write a `.lua` file and pass it with `--script`. Multiple scripts are supported.

```lua
-- Auto-cure poison
createTrigger("You have been poisoned!", function()
  send("drink antidote")
  echo("Auto-cured poison!")
end)

-- Flee when health drops below 30%
createTrigger("^You have (\\d+)/(\\d+) health", function(matches)
  local current = tonumber(matches[2])
  local max     = tonumber(matches[3])
  if current < max * 0.3 then
    send("flee")
  end
end, { type = "regex" })

-- Expand "n5" into five "north" commands
createAlias("^n(\\d+)$", function(matches)
  for i = 1, tonumber(matches[2]) do
    send("north")
  end
end, { type = "regex" })

-- Auto-look every 30 seconds
createTimer(30000, function()
  send("look")
end, { name = "auto-look" })
```

Run Lua interactively without restarting:

```
/lua echo("hello")
/lua send("look")
/lua getTimers()
```

## Features

| Feature | Description |
|---------|-------------|
| [Triggers](docs/triggers.md) | Fire Lua callbacks on inbound or outbound text patterns |
| [Aliases](docs/aliases.md) | Intercept and expand user input |
| [Timers](docs/timers.md) | Schedule Lua functions to run at intervals |
| [Sounds](docs/sounds.md) | Play audio files and text-to-speech from Lua |
| [API Reference](docs/api.md) | All Lua global functions |

## Keyboard Shortcuts

### Input

| Key | Action |
|-----|--------|
| Enter | Send command |
| CTRL-L | Clear screen |
| CTRL-C | Exit |

### History

| Key | Action |
|-----|--------|
| Up / CTRL-P | Previous command |
| Down / CTRL-N | Next command |
| CTRL-R | Reverse search through history |
| CTRL-S | Forward search through history |
| Tab | Autocomplete from history |

### Line editing

| Key | Action |
|-----|--------|
| Left / CTRL-B | Move cursor left |
| Right / CTRL-F | Move cursor right |
| CTRL-A | Move to beginning of line |
| CTRL-E | Move to end of line |
| CTRL-K | Delete to end of line |
| CTRL-D | Delete character at cursor |
| CTRL-U | Delete to beginning of line |

## Connection Profiles

Profiles are stored in `profiles.json` in your platform config directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/baud/` |
| Linux | `~/.config/baud/` |
| Windows | `%APPDATA%\baud\` |

Profiles can also be edited manually:

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

Profile fields: `id`, `name`, `protocol` (`"telnet"` or `"ssh"`), `host`, `port`, and optional `username`, `password`, `privateKey` for SSH.

## Development

See [docs/development.md](docs/development.md) for local setup, running tests, and project structure.

## License

MIT
