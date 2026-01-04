# Baud - Telnet BBS Client

A Java CLI application for connecting to Bulletin Board Systems (BBS) via telnet, with support for ANSI graphics and faithful terminal I/O.

## Features

- **Telnet Protocol**: Full telnet support using Apache Commons Net
- **ANSI Graphics**: Faithful rendering of ANSI escape codes, colors, and ASCII art
- **Line Editing**: Local line editing with cursor movement, backspace, forward delete, and kill commands
- **Text Expansions**: Define shortcuts that expand to longer commands
- **Lua Scripting**: Embedded Lua engine with state management and automation
- **Pattern-Based Triggers**: Execute Lua scripts automatically when BBS output matches patterns
- **Raw Terminal Mode**: Character-by-character I/O for responsive BBS interaction
- **Cross-Platform**: Works on Windows, macOS, and Linux via JLine
- **Simple Interface**: Easy command-line usage

## Requirements

- Java 21 or higher
- Maven 3.6+

## Building

Build the project with Maven:

```bash
mvn clean package
```

This creates an executable JAR with all dependencies in `target/baud-1.0-SNAPSHOT.jar`.

## Installation

After building, you can run the JAR directly or create an alias/script for convenience:

### Unix/Linux/macOS

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
alias baud='java -jar /path/to/baud/target/baud-1.0-SNAPSHOT.jar'
```

Or create a script in `/usr/local/bin/baud`:

```bash
#!/bin/bash
java -jar /path/to/baud/target/baud-1.0-SNAPSHOT.jar "$@"
```

Make it executable:

```bash
chmod +x /usr/local/bin/baud
```

### Windows

Create a `baud.bat` file in a directory on your PATH:

```batch
@echo off
java -jar C:\path\to\baud\target\baud-1.0-SNAPSHOT.jar %*
```

## Testing

Run the unit test suite with Maven:

```bash
mvn test
```

The project uses JUnit 5 for testing. Tests are located in `src/test/java/` and cover core functionality including line editing, cursor movement, and text manipulation.

To run tests with verbose output:

```bash
mvn test -X
```

## Usage

### Basic Connection

Connect to a BBS on the default telnet port (23):

```bash
baud bbs.example.com
```

### Custom Port

Connect to a BBS on a different port:

```bash
baud bbs.example.com 2323
```

### Connection Timeout

Specify a connection timeout in seconds:

```bash
baud bbs.example.com 23 --timeout 60
```

### Help

Display help information:

```bash
baud --help
```

### Debug Mode

Enable debug output by setting the DEBUG environment variable:

```bash
DEBUG=true baud bbs.example.com
```

This will print additional diagnostic information during the session, useful for troubleshooting connection issues or character encoding problems.

## Advanced Features

### Text Expansions

Baud supports text expansions that allow you to define shortcuts that expand to longer commands when you press Enter:

```bash
baud bbs.example.com --expansions expansions.txt
```

**Expansions File Format:**

```
# Comments start with #
shortcut=expansion text

# Examples:
tp=teleport
inv=inventory
scapl1=sca pl 1
```

When you type `tp` and press Enter, it will expand to `teleport` and be sent to the BBS.

### Lua Scripting

Baud includes a powerful Lua scripting engine that enables:
- **Interactive Lua Commands**: Execute Lua code with `/lua` prefix
- **State Management**: Store and retrieve variables across your session
- **Automated Responses**: Scripts can automatically send commands to the BBS
- **Pattern-Based Triggers**: Execute scripts when BBS output matches patterns

#### Interactive Lua Commands

Use `/lua` prefix to execute Lua code interactively:

```bash
baud bbs.example.com

# In the BBS session:
/lua setState("target_planet", 5)
/lua local hp = getState("hp_current")
/lua send("scan")
```

**Available Lua Functions:**
- `setState(key, value)` - Store a state variable
- `getState(key)` - Retrieve a state variable
- `send(text)` - Queue a command to send to the BBS

#### Text Expansions with Lua

Expansions can expand to `/lua` commands for powerful shortcuts:

```
# expansions.txt
setplanet1=/lua setState("target_planet", 1)
setplanet2=/lua setState("target_planet", 2)
checkhp=/lua local hp = getState("hp_current"); send("HP: " .. hp)
```

#### Pattern-Based Automation

Load Lua scripts that automatically execute when BBS output matches regex patterns:

```bash
baud bbs.example.com --lua-scripts ./scripts --lua-patterns patterns.txt
```

**Patterns File Format** (patterns.txt):

```
# REGEX_PATTERN | script_name.lua | COMMENT
Your health: (\d+)/(\d+) | health_monitor.lua | Track HP
Planet (\d+) | planet_scan.lua | Track planets
```

**Example Lua Script** (health_monitor.lua):

```lua
-- Capture groups available in match[1], match[2], etc.
local current_hp = tonumber(match[1])
local max_hp = tonumber(match[2])

setState("hp_current", current_hp)
setState("hp_max", max_hp)

-- Auto-heal if health is low
if current_hp / max_hp < 0.3 then
    send("use healing potion")
end
```

**Example Lua Script** (planet_scan.lua):

```lua
local planet_num = tonumber(match[1])
setState("last_planet", planet_num)

local target = getState("target_planet")
if target and planet_num == target then
    send("land")
end
```

#### State Sharing Between Scripts

All Lua scripts share the same state, enabling coordination:

```lua
-- Script 1 sets a value
setState("target_planet", 5)

-- Script 2 can read that value
local target = getState("target_planet")
if target == 5 then
    send("warp to planet 5")
end
```

#### Example Usage

```bash
# Start with all features enabled
baud bbs.example.com \
  --expansions examples/expansions.txt \
  --lua-scripts examples/lua-scripts \
  --lua-patterns examples/patterns.txt

# In the session:
setplanet5              # Expands to /lua setState("target_planet", 5)
scan                    # BBS responds with planet data
                        # planet_scan.lua triggers, sees planet 5, auto-lands
```

See the `examples/` directory for complete working examples.

## Controls

### Line Editing

Baud supports local line editing with cursor movement and editing commands:

**Cursor Movement:**
- **Left/Right Arrow Keys**: Move cursor backward/forward one character
- **Ctrl+A**: Jump to beginning of line
- **Ctrl+E**: Jump to end of line
- **Ctrl+B**: Move backward one character (same as left arrow)
- **Ctrl+F**: Move forward one character (same as right arrow)

**Editing:**
- **Backspace**: Delete character before cursor
- **Ctrl+D**: Forward delete (delete character at cursor)
- **Ctrl+K**: Delete from cursor to end of line

**Line Completion:**
- **Enter**: Send complete line to BBS

### Command Mode

- **Ctrl+]**: Enter telnet command mode
  - Type `quit` or `q` and press Enter to disconnect

## Technical Details

### Architecture

The application consists of six main components:

1. **BaudCli** - Main entry point using Picocli for command-line parsing
2. **TelnetSession** - Manages telnet connection using Apache Commons Net
3. **TerminalHandler** - Handles terminal I/O with JLine for ANSI support
4. **SessionManager** - Coordinates bidirectional I/O between terminal and BBS
5. **StateManager** - Manages state variables and pattern-based Lua triggers
6. **LuaScriptEngine** - Executes Lua scripts with state management API

### Dependencies

- **Picocli 4.7.5** - Modern CLI framework with ANSI support
- **Apache Commons Net 3.11.1** - Telnet client implementation
- **JLine 3.26.3** - Terminal handling with ANSI escape code support
- **LuaJ 3.0.1** - Embedded Lua scripting engine

### Terminal Emulation

The client advertises itself as a VT100 terminal and supports:

- ANSI color codes (16-color, 256-color)
- Text formatting (bold, underline, etc.)
- Cursor positioning
- ASCII/ANSI art

### Telnet Options

The client negotiates the following telnet options:

- **Echo**: Handled locally (server echo disabled)
- **Suppress Go-Ahead**: Enabled
- **Terminal Type**: VT100

## Example BBSes to Try

Here are some public BBSes you can connect to for testing:

- `bbs.fozztexx.com` (port 23) - FozzTexx's BBS
- `bbs.bottomlesspit.org` (port 23) - Bottomless Pit BBS
- `1984.ws` (port 23) - 1984 BBS

## Development

### Project Structure

```
baud/
├── pom.xml
├── src/
│   └── main/
│       └── java/
│           └── io/
│               └── github/
│                   └── jedcn/
│                       └── baud/
│                           ├── BaudCli.java
│                           ├── TelnetSession.java
│                           ├── TerminalHandler.java
│                           └── SessionManager.java
└── README.md
```

### Running in Development

Run directly with Maven:

```bash
mvn compile exec:java -Dexec.mainClass="io.github.jedcn.baud.BaudCli" -Dexec.args="bbs.example.com"
```

## Future Enhancements

Potential future features:

- SSH protocol support
- Session recording and playback
- Multiple simultaneous connections
- GUI or web-based interface
- Custom key bindings
- Scripting support

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Acknowledgments

Built with:
- [Picocli](https://picocli.info/) - CLI framework
- [Apache Commons Net](https://commons.apache.org/proper/commons-net/) - Telnet client
- [JLine](https://github.com/jline/jline3) - Terminal handling
