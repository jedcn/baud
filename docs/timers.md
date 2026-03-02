# Timers

Timers let you schedule Lua functions to run at regular intervals or after a delay. Use them for periodic automation, buff reminders, auto-actions, or any time-based logic.

## createTimer

```lua
createTimer(interval, callback, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `interval` | number | Milliseconds between executions |
| `callback` | function | Called when the timer fires |
| `options` | table | Optional: `repeating`, `enabled`, `name` |

**Options:**
- `repeating` — `true` (default) to repeat, `false` for a one-shot timer
- `enabled` — `true` (default) to start immediately, `false` to create paused
- `name` — Optional string label for easier identification

**Returns:** A timer ID string. Save this to control the timer later.

## Examples

**Repeating timer — send "look" every 30 seconds:**

```lua
createTimer(30000, function()
  send("look")
end, { name = "auto-look" })
```

**One-shot timer — announce something after a delay:**

```lua
createTimer(5000, function()
  send("say I'm back!")
end, { repeating = false, name = "announce-return" })
```

**Create a timer but don't start it yet:**

```lua
autoAttackTimer = createTimer(2000, function()
  send("attack")
end, { enabled = false, name = "auto-attack" })

-- Start it later:
-- /lua enableTimer(autoAttackTimer)
```

**Buff reminder every 5 minutes:**

```lua
createTimer(300000, function()
  echo("*** Time to recast shield! ***")
end, { name = "shield-reminder" })
```

## Controlling Timers

### enableTimer(id)

Start or resume a paused timer.

```lua
local id = createTimer(1000, function()
  echo("tick")
end, { enabled = false })

enableTimer(id)
```

### disableTimer(id)

Pause a running timer without removing it. Can be resumed with `enableTimer`.

```lua
disableTimer(autoAttackTimer)
```

### removeTimer(id)

Stop and permanently remove a timer.

```lua
removeTimer(id)  -- returns true if found and removed
```

## Inspecting Timers

### getTimers()

Returns a list of all timers with their current state.

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
- `id` — Unique timer identifier
- `interval` — Milliseconds between executions
- `repeating` — Whether the timer repeats
- `enabled` — Whether the timer is enabled
- `running` — Whether the timer is currently active
- `name` — Optional name (if provided)

**Remove all timers:**

```lua
for i, timer in ipairs(getTimers()) do
  removeTimer(timer.id)
end
echo("All timers removed")
```

## Interactive Timer Control

Timers created in a script can be controlled from the `/lua` command at runtime:

```
/lua disableTimer(autoAttackTimer)
/lua enableTimer(autoAttackTimer)
/lua removeTimer(autoAttackTimer)
/lua getTimers()
```

## See Also

- [Triggers](triggers.md) — React to server output
- [Aliases](aliases.md) — Intercept user input
- [API Reference](api.md) — All Lua global functions
