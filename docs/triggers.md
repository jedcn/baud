# Triggers

Triggers watch text flowing through baud and fire a Lua callback when a pattern matches. There are two kinds: **inbound triggers** match output arriving from the server, and **outbound triggers** match commands being sent to the server.

## Inbound Triggers

Use `createTrigger` to react to server output.

```lua
createTrigger(pattern, callback, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | Text to match (literal or regex) |
| `callback` | function | Called when pattern matches |
| `options` | table | Optional: `type`, `enabled` |

**Options:**
- `type` — `"literal"` (default) or `"regex"`
- `enabled` — `true` (default) or `false`

**Returns:** A trigger ID string.

### Callback Arguments

The callback receives two arguments:

```lua
function(matches, context)
```

- `matches` — For literal triggers, `matches[1]` is the full matched line. For regex triggers, `matches[1]` is the full match and `matches[2]`, `matches[3]`, etc. are capture groups.
- `context` — A table with metadata about the matched line (optional).

**Context fields:**
- `context.isLastLine` — `true` if this is the last non-empty line in the received data chunk, meaning the server is likely waiting for input. Useful for BBS servers that bundle multiple screens in one TCP packet — you can avoid firing on stale prompts by checking this field.

### Examples

**Simple literal trigger:**

```lua
createTrigger("You have been poisoned!", function()
  send("drink antidote")
  echo("Auto-cured poison!")
end)
```

**Regex trigger with capture groups:**

> **Note:** Escape backslashes in Lua regex strings — use `\\d` not `\d`, `\\w` not `\w`.

```lua
createTrigger("^You have (\\d+)/(\\d+) health", function(matches)
  local current = tonumber(matches[2])  -- first capture group
  local max     = tonumber(matches[3])  -- second capture group
  if current < max * 0.3 then
    send("flee")
    echo("Health critical! Fleeing!")
  end
end, { type = "regex" })
```

**Using `context.isLastLine` to avoid stale prompts:**

Some BBS servers send a prompt bundled with the next screen in a single TCP packet. Without checking `isLastLine`, the trigger would fire even after the server has moved past the prompt.

```lua
createTrigger("^\\(N\\)onstop", function(matches, context)
  if context.isLastLine then
    send("n")
  end
end, { type = "regex" })
```

**Highlight tells from other players:**

```lua
createTrigger("^(\\w+) tells you", function(matches)
  echo(">>> Message from: " .. matches[2])
end, { type = "regex" })
```

## Outbound Triggers

Use `createOutboundTrigger` to react to commands being sent to the server. This fires on both programmatic `send()` calls and user-typed commands.

Useful for tracking what commands are sent, setting local state before server responses arrive, or coordinating between outbound commands and inbound triggers.

```lua
createOutboundTrigger(pattern, callback, options)
```

Parameters and options are identical to `createTrigger`.

### Examples

**Track when rotation commands are sent:**

```lua
createOutboundTrigger("^rot (-?\\d+)$", function(matches)
  local amount = tonumber(matches[2])
  if amount == 0 then
    rotProbe = true
    echo("[Rotation probe sent]")
  else
    rotProbe = false
    rotationInProgress = true
    echo("[Rotating by " .. amount .. " degrees]")
  end
end, { type = "regex" })
```

**Track scan commands:**

```lua
createOutboundTrigger("^scan planet (\\d+)$", function(matches)
  scanningPlanet = tonumber(matches[2])
  echo("[Scanning planet " .. scanningPlanet .. "]")
end, { type = "regex" })
```

## Inspecting Triggers

### getTriggers()

Returns a list of all inbound triggers.

```lua
local triggers = getTriggers()
for i, trigger in ipairs(triggers) do
  echo(string.format("Trigger %s: pattern=%s, type=%s, enabled=%s",
    trigger.id, trigger.pattern, trigger.type, tostring(trigger.enabled)))
end
```

Each trigger object contains:
- `id` — Unique trigger identifier
- `pattern` — The pattern string
- `type` — `"literal"` or `"regex"`
- `enabled` — Whether the trigger is active

### getOutboundTriggers()

Returns a list of all outbound triggers. Same structure as above.

```lua
local triggers = getOutboundTriggers()
for i, trigger in ipairs(triggers) do
  echo(string.format("Outbound trigger %s: pattern=%s, enabled=%s",
    trigger.id, trigger.pattern, tostring(trigger.enabled)))
end
```

## See Also

- [Aliases](aliases.md) — Match and intercept user input
- [Timers](timers.md) — Schedule actions at intervals
- [API Reference](api.md) — All Lua global functions
