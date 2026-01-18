-- Debug alias matching

echo("Creating test alias...")

-- NOTE: In Lua, backslashes in strings need to be escaped!
-- Use \\w instead of %w for regex patterns
createAlias("^greet (\\w+)$", function(matches)
  echo("*** ALIAS MATCHED! ***")
  if matches then
    echo("Matches type: " .. type(matches))
    local name = matches[1]
    if name then
      echo("Got name: " .. name)
      send("say Hello, " .. name .. "!")
    else
      echo("matches[1] is nil")
    end
  else
    echo("matches is nil")
  end
end, { type = "regex" })

echo("Test alias created. Try: greet jed")

-- Also create a simple literal alias to test
createAlias("test", function()
  echo("Simple test alias worked!")
end)

echo("Also try: test")
