-- Health Monitor Script
-- Triggered by pattern: Your health: (\d+)/(\d+)
-- Monitors health and auto-heals when low

local current_hp = tonumber(match[1])
local max_hp = tonumber(match[2])

-- Save current health state
setState("hp_current", current_hp)
setState("hp_max", max_hp)

-- Calculate health percentage
local health_percent = current_hp / max_hp

-- Auto-heal if health is below 30%
if health_percent < 0.3 then
    send("use healing potion")
end
