# Aliases

Aliases intercept user input before it is sent to the server. When the text you type matches an alias pattern, the alias callback runs instead of (or in addition to) sending the raw input.

Use aliases to create shortcuts, expand abbreviations, add parameters, or execute multi-step sequences from a single command.

## createAlias

```lua
createAlias(pattern, callback, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | Text to match (literal or regex) |
| `callback` | function | Called when pattern matches |
| `options` | table | Optional: `type`, `enabled` |

**Options:**
- `type` — `"literal"` (default) or `"regex"`
- `enabled` — `true` (default) or `false`

**Returns:** An alias ID string.

### Callback Arguments

The callback receives a `matches` table:

- For **literal** aliases, `matches[1]` is the full matched input.
- For **regex** aliases, `matches[1]` is the full match, and `matches[2]`, `matches[3]`, etc. are capture groups.

> **Note:** Escape backslashes in Lua regex strings — use `\\d` not `\d`, `\\w` not `\w`.

## Examples

**Simple shortcut:**

```lua
createAlias("^gg$", function()
  send("say Good game, everyone!")
end, { type = "regex" })
```

**Alias with a parameter:**

```lua
createAlias("^greet (\\w+)$", function(matches)
  send("say Hello, " .. matches[2] .. "!")
end, { type = "regex" })
```

Type `greet Alice` and baud sends `say Hello, Alice!`.

**Repeat a command N times:**

```lua
createAlias("^n(\\d+)$", function(matches)
  local times = tonumber(matches[2])
  for i = 1, times do
    send("north")
  end
end, { type = "regex" })
```

Type `n5` and baud sends `north` five times.

**Conditional alias with state tracking:**

```lua
mana_current = 100

createTrigger("^Mana: (\\d+)/(\\d+)", function(matches)
  mana_current = tonumber(matches[2])
end, { type = "regex" })

createAlias("^cast (\\w+)$", function(matches)
  if mana_current >= 20 then
    send("cast " .. matches[2])
  else
    echo("Not enough mana!")
  end
end, { type = "regex" })
```

**Literal alias:**

```lua
createAlias("inv", function()
  send("inventory")
  send("equipment")
end)
```

Type `inv` exactly and baud sends both `inventory` and `equipment`.

## Inspecting Aliases

### getAliases()

Returns a list of all aliases.

```lua
local aliases = getAliases()
for i, alias in ipairs(aliases) do
  echo(string.format("Alias %s: pattern=%s, type=%s, enabled=%s",
    alias.id, alias.pattern, alias.type, tostring(alias.enabled)))
end
```

Each alias object contains:
- `id` — Unique alias identifier
- `pattern` — The pattern string
- `type` — `"literal"` or `"regex"`
- `enabled` — Whether the alias is active

## See Also

- [Triggers](triggers.md) — React to server output
- [Timers](timers.md) — Schedule actions at intervals
- [API Reference](api.md) — All Lua global functions
