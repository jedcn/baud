package io.github.jedcn.baud;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class SessionManager {

    private final TerminalHandler terminalHandler;
    private final TelnetSession telnetSession;
    private volatile boolean running;

    // Escape sequence: Ctrl+] (ASCII 29)
    private static final int ESCAPE_CHAR = 29;
    private boolean escapeMode = false;
    private StringBuilder escapeCommand = new StringBuilder();

    public SessionManager(TerminalHandler terminalHandler, TelnetSession telnetSession) {
        this.terminalHandler = terminalHandler;
        this.telnetSession = telnetSession;
        this.running = false;
    }

    public void run() throws IOException {
        running = true;

        InputStream telnetInput = telnetSession.getInputStream();
        OutputStream telnetOutput = telnetSession.getOutputStream();

        // Create thread for reading from BBS and writing to terminal
        Thread bbsToTerminal = new Thread(() -> {
            byte[] buffer = new byte[4096];
            try {
                while (running && telnetSession.isConnected()) {
                    int bytesRead = telnetInput.read(buffer);
                    if (bytesRead == -1) {
                        // Connection closed by server
                        running = false;
                        break;
                    }
                    if (bytesRead > 0) {
                        terminalHandler.write(buffer, 0, bytesRead);
                    }
                }
            } catch (IOException e) {
                if (running) {
                    System.err.println("\nError reading from BBS: " + e.getMessage());
                }
                running = false;
            }
        }, "BBS-to-Terminal");

        bbsToTerminal.setDaemon(true);
        bbsToTerminal.start();

        // Main thread: Read from terminal and write to BBS
        try {
            while (running && telnetSession.isConnected()) {
                int ch = terminalHandler.read(100); // 100ms timeout

                if (ch == -1) {
                    continue; // Timeout, try again
                }

                if (ch == -2) {
                    // EOF on terminal input
                    running = false;
                    break;
                }

                // Handle escape sequence (Ctrl+])
                if (ch == ESCAPE_CHAR) {
                    escapeMode = true;
                    escapeCommand.setLength(0);
                    terminalHandler.write("\r\ntelnet> ".getBytes());
                    continue;
                }

                if (escapeMode) {
                    if (ch == '\r' || ch == '\n') {
                        // Process escape command
                        String command = escapeCommand.toString().trim();
                        if (command.equalsIgnoreCase("quit") || command.equalsIgnoreCase("q")) {
                            running = false;
                            break;
                        } else {
                            terminalHandler.write(("\r\nUnknown command: " + command + "\r\n").getBytes());
                        }
                        escapeMode = false;
                        escapeCommand.setLength(0);
                    } else if (ch == 127 || ch == 8) {
                        // Backspace
                        if (escapeCommand.length() > 0) {
                            escapeCommand.setLength(escapeCommand.length() - 1);
                            terminalHandler.write(new byte[]{8, ' ', 8}); // Backspace, space, backspace
                        }
                    } else if (ch >= 32 && ch < 127) {
                        // Printable character
                        escapeCommand.append((char) ch);
                        terminalHandler.write(ch);
                    }
                    continue;
                }

                // Send character to BBS
                telnetOutput.write(ch);
                telnetOutput.flush();
            }
        } catch (IOException e) {
            if (running) {
                System.err.println("\nError during session: " + e.getMessage());
            }
        } finally {
            running = false;
            // Wait for BBS reader thread to finish
            try {
                bbsToTerminal.join(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
