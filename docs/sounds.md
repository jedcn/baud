# Sounds

baud can play audio files and speak text aloud from Lua scripts. Use sounds to get audio feedback from game events — health warnings, tell notifications, timer alerts — without keeping your eyes on the screen.

> **Platform note:** Sound playback uses `afplay` and `say`, which are macOS system commands. Linux and Windows support may require additional configuration.

## Registering Sounds

Before playing a sound, register it with a name and a file path.

### registerSound(name, filepath)

```lua
registerSound(name, filepath)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Name to reference this sound by |
| `filepath` | string | Path to the audio file |

```lua
registerSound("alert", "/path/to/alert.mp3")
registerSound("heal", "/path/to/heal.wav")
registerSound("death", "/path/to/death.mp3")
```

## Playing Sounds

### playSound(name, options)

Play a registered sound by name.

```lua
playSound(name, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Name of a registered sound |
| `options` | table | Optional: `volume` |

**Options:**
- `volume` — A number from `0.0` to `1.0` (default: `1.0`)

```lua
-- Play at full volume
playSound("alert")

-- Play quietly
playSound("alert", { volume = 0.5 })
```

**Example — play a sound when health is low:**

```lua
registerSound("danger", "/sounds/danger.mp3")

createTrigger("^You have (\\d+)/(\\d+) health", function(matches)
  local current = tonumber(matches[2])
  local max     = tonumber(matches[3])
  if current < max * 0.3 then
    playSound("danger")
    send("flee")
  end
end, { type = "regex" })
```

**Example — play a sound on a tell:**

```lua
registerSound("tell", "/sounds/ding.mp3")

createTrigger("^(\\w+) tells you", function(matches)
  playSound("tell")
  echo(">>> Tell from " .. matches[2])
end, { type = "regex" })
```

## Text-to-Speech

### say(text, options)

Speak text aloud using the system text-to-speech engine.

```lua
say(text, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | Text to speak |
| `options` | table | Optional: `voice`, `rate` |

**Options:**
- `voice` — Voice name string (system-dependent)
- `rate` — Speech rate as a number (system-dependent)

```lua
-- Simple announcement
say("Health critical!")

-- With voice and rate options
say("Incoming attack!", { voice = "Alex", rate = 200 })
```

**Example — announce tells:**

```lua
createTrigger("^(\\w+) tells you: (.+)$", function(matches)
  say(matches[2] .. " says: " .. matches[3])
end, { type = "regex" })
```

## Managing Sounds

### getSounds()

Returns a list of all registered sounds.

```lua
local sounds = getSounds()
for i, sound in ipairs(sounds) do
  echo(string.format("Sound: %s -> %s", sound.name, sound.filepath))
end
```

### removeSound(name)

Unregister a sound by name.

```lua
removeSound("alert")
```

## See Also

- [Triggers](triggers.md) — Fire sounds in response to server output
- [Timers](timers.md) — Play sounds on a schedule
- [API Reference](api.md) — All Lua global functions
