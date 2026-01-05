-- Planet Scanner Script
-- Triggered by pattern: Planet (\d+)
-- Tracks planet numbers and auto-lands on target planet

local planet_num = tonumber(match[1])

-- Save the last scanned planet
setState("last_planet", planet_num)

-- Check if this is our target planet
local target = getState("target_planet")
if target and planet_num == target then
    send("land")
end
