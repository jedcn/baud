-- Example triggers and aliases for baud
-- Load this with: baud --profile myserver --script triggers.lua

echo("Loading triggers and aliases...")

-- Simple trigger: literal text match
createTrigger("Welcome to the game!", function()
  echo("*** Connected successfully! ***")
  send("look")
end)

-- Regex trigger with capture groups
createTrigger("^You have (%d+)/(%d+) health", function(matches)
  local current = tonumber(matches[1])
  local max = tonumber(matches[2])
  local percent = (current / max) * 100

  echo(string.format("Health: %d%% (%d/%d)", percent, current, max))

  if percent < 30 then
    echo("WARNING: Health critical!")
    send("flee")
  end
end, { type = "regex" })

-- Trigger that highlights messages from specific players
createTrigger("^(%w+) tells you", function(matches)
  local player = matches[1]
  echo(">>> Message from: " .. player)
end, { type = "regex" })

-- Gag trigger: hide spam messages
createTrigger("The shopkeeper yawns.", function()
  -- This line will be hidden from output
end, { gag = true })

-- Simple alias: expand "gg" to "say Good game!"
createAlias("^gg$", function()
  send("say Good game, everyone!")
end, { type = "regex" })

-- Alias with capture groups: greet a player
createAlias("^greet (%w+)$", function(matches)
  local name = matches[1]
  send("say Hello, " .. name .. "!")
  send("emote waves at " .. name)
end, { type = "regex" })

-- Alias for quick navigation
createAlias("^n(%d+)$", function(matches)
  local times = tonumber(matches[1])
  for i = 1, times do
    send("north")
  end
  echo("Moving north " .. times .. " times")
end, { type = "regex" })

-- Complex alias: Auto-cast spell with mana check
mana_current = 100
mana_max = 100

-- Track mana from server
createTrigger("^Mana: (%d+)/(%d+)", function(matches)
  mana_current = tonumber(matches[1])
  mana_max = tonumber(matches[2])
end, { type = "regex" })

-- Cast spell only if we have enough mana
createAlias("^cast (%w+)$", function(matches)
  local spell = matches[1]
  local mana_cost = 20  -- Simple example

  if mana_current >= mana_cost then
    send("cast " .. spell)
    echo("Casting " .. spell)
  else
    echo("Not enough mana! (" .. mana_current .. "/" .. mana_cost .. ")")
  end
end, { type = "regex" })

echo("Triggers and aliases loaded!")
echo("Try typing: gg, greet Alice, n5, cast fireball")
