# Lua API Reference

baud exposes a set of global functions to all Lua scripts. These are available in scripts loaded with `--script`, in interactive `/lua` commands, and in trigger, alias, and timer callbacks.

## Loading Scripts

Load Lua files at startup with `--script`:

```bash
bun run src/main.tsx --profile myserver --script ./triggers.lua

# Multiple scripts
bun run src/main.tsx --profile myserver --script ./triggers.lua --script ./ui.lua
```

## Interactive Execution

Execute Lua interactively with the `/lua` command:

```
/lua echo("Hello from Lua!")
/lua send("look")
/lua x = 5 + 3
/lua echo("Result: " .. x)
```

---

## Core Functions

### send(text)

Send a command to the server.

```lua
send("look")
send("say Hello, world!")
```

### echo(text)

Display a message in the output area. Visible only to you, not sent to the server.

```lua
echo("Script loaded!")
echo("Health: 100/100")
```

### setStatus(segments)

Update the status bar with custom content.

```lua
setStatus({
  { text = "HP: 100/100", color = "green" },
  { text = " | " },
  { text = "Mana: 80/100", color = "blue" },
})
```

### reloadScript()

Reload the current Lua script from disk without restarting baud.

```lua
reloadScript()
```

Useful while developing scripts — make a change, then run `/lua reloadScript()` to pick it up.

---

## Triggers

See [Triggers](triggers.md) for full documentation and examples.

| Function | Description |
|----------|-------------|
| `createTrigger(pattern, callback, options)` | Fire callback when server output matches |
| `createOutboundTrigger(pattern, callback, options)` | Fire callback when a command is sent |
| `getTriggers()` | List all inbound triggers |
| `getOutboundTriggers()` | List all outbound triggers |

---

## Aliases

See [Aliases](aliases.md) for full documentation and examples.

| Function | Description |
|----------|-------------|
| `createAlias(pattern, callback, options)` | Intercept user input matching a pattern |
| `getAliases()` | List all aliases |

---

## Timers

See [Timers](timers.md) for full documentation and examples.

| Function | Description |
|----------|-------------|
| `createTimer(interval, callback, options)` | Schedule a function to run at intervals |
| `getTimers()` | List all timers with current state |
| `removeTimer(id)` | Stop and remove a timer |
| `enableTimer(id)` | Start or resume a paused timer |
| `disableTimer(id)` | Pause a running timer |

---

## Sounds

See [Sounds](sounds.md) for full documentation and examples.

| Function | Description |
|----------|-------------|
| `registerSound(name, filepath)` | Register an audio file |
| `playSound(name, options)` | Play a registered sound |
| `removeSound(name)` | Unregister a sound |
| `getSounds()` | List all registered sounds |
| `say(text, options)` | Speak text using text-to-speech |

---

## Pattern Matching Notes

Both triggers and aliases support two pattern types:

- **`"literal"`** (default) — plain text substring match
- **`"regex"`** — JavaScript regular expression

When writing regex patterns in Lua strings, backslashes must be doubled:

| Regex intent | Write in Lua |
|---|---|
| `\d` (digit) | `\\d` |
| `\w` (word char) | `\\w` |
| `\s` (whitespace) | `\\s` |
| `\.` (literal dot) | `\\.` |

**Capture groups** are accessed as `matches[2]`, `matches[3]`, etc. (`matches[1]` is always the full match).

```lua
-- matches[2] = first capture group, matches[3] = second
createTrigger("^HP: (\\d+)/(\\d+)$", function(matches)
  local current = tonumber(matches[2])
  local max     = tonumber(matches[3])
end, { type = "regex" })
```
