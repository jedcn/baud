package io.github.jedcn.baud;

import java.io.IOException;

/**
 * Interface for terminal write operations.
 * This abstraction makes LineEditor testable without requiring a real terminal.
 */
public interface TerminalWriter {
    void write(byte[] data) throws IOException;
    void write(byte[] data, int offset, int length) throws IOException;
    void write(int b) throws IOException;
}
