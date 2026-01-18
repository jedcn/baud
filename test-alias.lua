-- Test alias with capture groups

echo("Testing alias...")

createAlias("^greet (%w+)$", function(matches)
  echo("Alias matched!")
  echo("Type of matches: " .. type(matches))

  if matches then
    echo("matches is not nil")
    for k, v in pairs(matches) do
      echo("  " .. tostring(k) .. " = " .. tostring(v))
    end

    if matches[1] then
      local name = matches[1]
      echo("Got name: " .. name)
      send("say Hello, " .. name .. "!")
    else
      echo("matches[1] is nil!")
    end
  else
    echo("matches is nil!")
  end
end, { type = "regex" })

echo("Alias created. Try typing: greet claude")
