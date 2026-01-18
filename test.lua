-- Test Lua script for baud

echo("Test script loaded successfully!")

function greet()
  echo("Hello from Lua function!")
end

function look_around()
  send("look")
  echo("Sent look command to server")
end
