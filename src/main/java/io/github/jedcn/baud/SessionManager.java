package io.github.jedcn.baud;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class SessionManager {

    private static final boolean DEBUG = "true".equalsIgnoreCase(System.getenv("DEBUG"));

    private final TerminalHandler terminalHandler;
    private final TelnetSession telnetSession;
    private final LineEditor lineEditor;
    private volatile boolean running;

    // Escape sequence: Ctrl+] (ASCII 29)
    private static final int ESCAPE_CHAR = 29;
    private boolean escapeMode = false;
    private StringBuilder escapeCommand = new StringBuilder();

    public SessionManager(TerminalHandler terminalHandler, TelnetSession telnetSession) {
        this.terminalHandler = terminalHandler;
        this.telnetSession = telnetSession;
        this.lineEditor = new LineEditor(terminalHandler);
        this.running = false;
    }

    public void run() throws IOException {
        running = true;
        if (DEBUG) System.err.println("[DEBUG] Session started, running=" + running);

        InputStream telnetInput = telnetSession.getInputStream();
        OutputStream telnetOutput = telnetSession.getOutputStream();
        if (DEBUG) System.err.println("[DEBUG] Got telnet streams");

        // Create thread for reading from BBS and writing to terminal
        Thread bbsToTerminal = new Thread(() -> {
            if (DEBUG) System.err.println("[DEBUG] BBS-to-Terminal thread started");
            byte[] buffer = new byte[4096];
            try {
                while (running && telnetSession.isConnected()) {
                    int bytesRead = telnetInput.read(buffer);
                    if (DEBUG) System.err.println("[DEBUG] BBS read: " + bytesRead + " bytes");
                    if (bytesRead == -1) {
                        // Connection closed by server
                        if (DEBUG) System.err.println("[DEBUG] BBS closed connection (EOF)");
                        running = false;
                        break;
                    }
                    if (bytesRead > 0) {
                        terminalHandler.write(buffer, 0, bytesRead);
                    }
                }
            } catch (IOException e) {
                if (DEBUG) System.err.println("[DEBUG] BBS read exception: " + e.getClass().getName() + ": " + e.getMessage());
                if (running) {
                    System.err.println("\nError reading from BBS: " + e.getMessage());
                }
                running = false;
            }
            if (DEBUG) System.err.println("[DEBUG] BBS-to-Terminal thread ending");
        }, "BBS-to-Terminal");

        bbsToTerminal.setDaemon(true);
        bbsToTerminal.start();
        if (DEBUG) System.err.println("[DEBUG] BBS-to-Terminal thread launched");

        // Main thread: Read from terminal and write to BBS
        if (DEBUG) System.err.println("[DEBUG] Starting terminal read loop");
        try {
            int readCount = 0;
            while (running && telnetSession.isConnected()) {
                int ch = terminalHandler.read(); // Blocking read

                if (DEBUG && readCount < 10) {
                    System.err.println("[DEBUG] Terminal read #" + readCount + ": ch=" + ch);
                    readCount++;
                }

                if (ch == -2) {
                    // EOF on terminal input
                    if (DEBUG) System.err.println("[DEBUG] Terminal EOF detected, exiting");
                    running = false;
                    break;
                }

                if (ch == -1) {
                    // This shouldn't happen with blocking read, but handle it
                    if (DEBUG) System.err.println("[DEBUG] Terminal read returned -1, continuing");
                    continue;
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

                // Process character through line editor
                boolean lineComplete = lineEditor.processChar(ch);

                if (lineComplete) {
                    // Get the complete line and send to BBS
                    String line = lineEditor.getLine();
                    telnetOutput.write(line.getBytes());
                    telnetOutput.write('\r');  // Send carriage return
                    telnetOutput.write('\n');  // Send line feed
                    telnetOutput.flush();

                    if (DEBUG) {
                        System.err.println("[DEBUG] Sent line to BBS: " + line);
                    }

                    // Reset line editor for next line
                    lineEditor.reset();
                }
            }
        } catch (IOException e) {
            if (DEBUG) {
                System.err.println("[DEBUG] Terminal read exception: " + e.getClass().getName() + ": " + e.getMessage());
                e.printStackTrace(System.err);
            }
            if (running) {
                System.err.println("\nError during session: " + e.getMessage());
            }
        } finally {
            if (DEBUG) System.err.println("[DEBUG] Exiting main loop, running=" + running);
            running = false;
            // Wait for BBS reader thread to finish
            try {
                if (DEBUG) System.err.println("[DEBUG] Waiting for BBS-to-Terminal thread to finish...");
                bbsToTerminal.join(1000);
                if (DEBUG) System.err.println("[DEBUG] BBS-to-Terminal thread joined");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                if (DEBUG) System.err.println("[DEBUG] Interrupted while waiting for thread");
            }
        }
    }
}
