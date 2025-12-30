package io.github.jedcn.baud;

import org.jline.terminal.Terminal;
import org.jline.terminal.TerminalBuilder;
import org.jline.terminal.Attributes;
import org.jline.utils.NonBlockingReader;

import java.io.IOException;
import java.io.PrintWriter;

public class TerminalHandler implements AutoCloseable {

    private Terminal terminal;
    private NonBlockingReader reader;
    private PrintWriter writer;
    private Attributes originalAttributes;

    public TerminalHandler() throws IOException {
        // Create a JLine terminal
        this.terminal = TerminalBuilder.builder()
                .system(true)
                .build();

        // Save original terminal attributes so we can restore them later
        this.originalAttributes = terminal.getAttributes();

        // Get reader and writer
        this.reader = terminal.reader();
        this.writer = terminal.writer();

        // Enter raw mode for character-by-character input
        enterRawMode();
    }

    private void enterRawMode() {
        Attributes attrs = new Attributes(originalAttributes);

        // Disable canonical mode (line buffering) and echo
        attrs.setLocalFlag(Attributes.LocalFlag.ICANON, false);
        attrs.setLocalFlag(Attributes.LocalFlag.ECHO, false);
        attrs.setLocalFlag(Attributes.LocalFlag.ISIG, false);

        // Disable input processing
        attrs.setInputFlag(Attributes.InputFlag.ICRNL, false);
        attrs.setInputFlag(Attributes.InputFlag.INLCR, false);

        // Set minimal input processing
        attrs.setControlChar(Attributes.ControlChar.VMIN, 1);
        attrs.setControlChar(Attributes.ControlChar.VTIME, 0);

        terminal.setAttributes(attrs);
    }

    public int read() throws IOException {
        return reader.read();
    }

    public int read(long timeout) throws IOException {
        return reader.read(timeout);
    }

    public void write(byte[] data) throws IOException {
        // Write raw bytes to terminal, preserving ANSI escape codes
        terminal.output().write(data);
        terminal.output().flush();
    }

    public void write(byte[] data, int offset, int length) throws IOException {
        // Write raw bytes to terminal with offset and length
        terminal.output().write(data, offset, length);
        terminal.output().flush();
    }

    public void write(int b) throws IOException {
        terminal.output().write(b);
        terminal.output().flush();
    }

    public void writeLine(String text) {
        writer.println(text);
        writer.flush();
    }

    public void flush() {
        writer.flush();
        try {
            terminal.output().flush();
        } catch (IOException e) {
            // Ignore flush errors
        }
    }

    public Terminal getTerminal() {
        return terminal;
    }

    @Override
    public void close() throws Exception {
        // Restore original terminal attributes
        if (originalAttributes != null) {
            terminal.setAttributes(originalAttributes);
        }

        if (terminal != null) {
            terminal.close();
        }
    }
}
