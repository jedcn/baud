-- Location Tracker Script
-- Triggered by pattern: You are in (.+)
-- Tracks current location and visit counts

local location = match[1]

-- Save current location
setState("current_location", location)

-- Track visit count for this location
local visit_key = "visits_" .. location
local visits = getState(visit_key) or 0
setState(visit_key, visits + 1)
