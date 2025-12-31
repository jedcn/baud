# Baud - Telnet BBS Client

A Java CLI application for connecting to Bulletin Board Systems (BBS) via telnet, with support for ANSI graphics and faithful terminal I/O.

## Features

- **Telnet Protocol**: Full telnet support using Apache Commons Net
- **ANSI Graphics**: Faithful rendering of ANSI escape codes, colors, and ASCII art
- **Line Editing**: Local line editing with cursor movement, backspace, forward delete, and kill commands
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

The application consists of four main components:

1. **BaudCli** - Main entry point using Picocli for command-line parsing
2. **TelnetSession** - Manages telnet connection using Apache Commons Net
3. **TerminalHandler** - Handles terminal I/O with JLine for ANSI support
4. **SessionManager** - Coordinates bidirectional I/O between terminal and BBS

### Dependencies

- **Picocli 4.7.5** - Modern CLI framework with ANSI support
- **Apache Commons Net 3.11.1** - Telnet client implementation
- **JLine 3.26.3** - Terminal handling with ANSI escape code support

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
