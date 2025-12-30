# Baud - Telnet BBS Client

A Java CLI application for connecting to Bulletin Board Systems (BBS) via telnet, with support for ANSI graphics and faithful terminal I/O.

## Features

- **Telnet Protocol**: Full telnet support using Apache Commons Net
- **ANSI Graphics**: Faithful rendering of ANSI escape codes, colors, and ASCII art
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

## Controls

- **Regular typing**: Characters are sent directly to the BBS as you type
- **Ctrl+]**: Enter command mode
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
