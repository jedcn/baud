package io.github.jedcn.baud;

import org.jline.terminal.Terminal;
import org.jline.terminal.TerminalBuilder;
import org.jline.terminal.Attributes;
import org.jline.utils.NonBlockingReader;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.Charset;

public class TerminalHandler implements AutoCloseable {

    private static final boolean DEBUG = "true".equalsIgnoreCase(System.getenv("DEBUG"));

    // CP437 to Unicode mapping for characters 128-255
    private static final char[] CP437_TO_UNICODE = {
        'Ç', 'ü', 'é', 'â', 'ä', 'à', 'å', 'ç', 'ê', 'ë', 'è', 'ï', 'î', 'ì', 'Ä', 'Å',  // 128-143
        'É', 'æ', 'Æ', 'ô', 'ö', 'ò', 'û', 'ù', 'ÿ', 'Ö', 'Ü', '¢', '£', '¥', '₧', 'ƒ',  // 144-159
        'á', 'í', 'ó', 'ú', 'ñ', 'Ñ', 'ª', 'º', '¿', '⌐', '¬', '½', '¼', '¡', '«', '»',  // 160-175
        '░', '▒', '▓', '│', '┤', '╡', '╢', '╖', '╕', '╣', '║', '╗', '╝', '╜', '╛', '┐',  // 176-191
        '└', '┴', '┬', '├', '─', '┼', '╞', '╟', '╚', '╔', '╩', '╦', '╠', '═', '╬', '╧',  // 192-207
        '╨', '╤', '╥', '╙', '╘', '╒', '╓', '╫', '╪', '┘', '┌', '█', '▄', '▌', '▐', '▀',  // 208-223
        'α', 'ß', 'Γ', 'π', 'Σ', 'σ', 'µ', 'τ', 'Φ', 'Θ', 'Ω', 'δ', '∞', 'φ', 'ε', '∩',  // 224-239
        '≡', '±', '≥', '≤', '⌠', '⌡', '÷', '≈', '°', '∙', '·', '√', 'ⁿ', '²', '■', ' '   // 240-255
    };

    private Terminal terminal;
    private NonBlockingReader reader;
    private PrintWriter writer;
    private Attributes originalAttributes;

    public TerminalHandler() throws IOException {
        // Create a JLine terminal with UTF-8 encoding to support Unicode box-drawing characters
        if (DEBUG) System.err.println("[DEBUG] Creating JLine terminal...");
        this.terminal = TerminalBuilder.builder()
                .system(true)
                .encoding(java.nio.charset.StandardCharsets.UTF_8)
                .build();
        if (DEBUG) System.err.println("[DEBUG] Terminal created: type=" + terminal.getType() + ", name=" + terminal.getName() + ", encoding=" + terminal.encoding());

        // Save original terminal attributes so we can restore them later
        this.originalAttributes = terminal.getAttributes();
        if (DEBUG) System.err.println("[DEBUG] Saved original attributes");

        // Get reader and writer
        this.reader = terminal.reader();
        this.writer = terminal.writer();
        if (DEBUG) System.err.println("[DEBUG] Got reader and writer, reader class=" + reader.getClass().getName());

        // Enter raw mode for character-by-character input
        enterRawMode();
        if (DEBUG) System.err.println("[DEBUG] Entered raw mode");
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

    private String cp437ToUnicode(byte[] data, int offset, int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int b = data[offset + i] & 0xFF;
            if (b < 128) {
                // ASCII characters 0-127 map directly
                sb.append((char) b);
            } else {
                // Extended ASCII 128-255 use CP437 mapping
                sb.append(CP437_TO_UNICODE[b - 128]);
            }
        }
        return sb.toString();
    }

    public void write(byte[] data) throws IOException {
        // Convert bytes to String using CP437 to preserve BBS graphics
        String text = cp437ToUnicode(data, 0, data.length);
        writer.print(text);
        writer.flush();
    }

    public void write(byte[] data, int offset, int length) throws IOException {
        // Convert bytes to String using CP437 to preserve BBS graphics
        String text = cp437ToUnicode(data, offset, length);
        writer.print(text);
        writer.flush();
    }

    public void write(int b) throws IOException {
        // Convert byte to char using CP437
        int byteVal = b & 0xFF;
        if (byteVal < 128) {
            writer.print((char) byteVal);
        } else {
            writer.print(CP437_TO_UNICODE[byteVal - 128]);
        }
        writer.flush();
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
