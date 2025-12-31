package io.github.jedcn.baud;

import java.io.IOException;

public class LineEditor {

    private static final boolean DEBUG = "true".equalsIgnoreCase(System.getenv("DEBUG"));

    // ANSI escape sequences for cursor control
    private static final String CURSOR_LEFT = "\u001B[D";
    private static final String CURSOR_RIGHT = "\u001B[C";
    private static final String CLEAR_TO_EOL = "\u001B[K";

    // Control characters
    private static final int CTRL_A = 1;
    private static final int CTRL_B = 2;
    private static final int CTRL_D = 4;
    private static final int CTRL_E = 5;
    private static final int CTRL_F = 6;
    private static final int CTRL_K = 11;
    private static final int BACKSPACE = 127;
    private static final int BACKSPACE_ALT = 8;
    private static final int CR = 13;
    private static final int LF = 10;
    private static final int ESC = 27;

    // Escape sequence parsing states
    private enum ParseState {
        NORMAL,      // Normal character input
        ESC_SEEN,    // ESC received, waiting for [
        CSI_SEEN     // ESC [ received, waiting for final byte
    }

    private final TerminalHandler terminal;
    private final StringBuilder buffer;
    private int cursorPos;
    private ParseState state;

    public LineEditor(TerminalHandler terminal) {
        this.terminal = terminal;
        this.buffer = new StringBuilder();
        this.cursorPos = 0;
        this.state = ParseState.NORMAL;
    }

    /**
     * Process a character from the terminal input.
     * Returns true if a complete line is ready to send.
     */
    public boolean processChar(int ch) throws IOException {
        if (DEBUG) {
            System.err.println("[LineEditor] processChar: ch=" + ch + " state=" + state + " cursorPos=" + cursorPos + " bufferLen=" + buffer.length());
        }

        switch (state) {
            case NORMAL:
                return processNormalChar(ch);

            case ESC_SEEN:
                return processEscSeenChar(ch);

            case CSI_SEEN:
                return processCsiSeenChar(ch);

            default:
                return false;
        }
    }

    /**
     * Get the complete line and prepare for next line.
     */
    public String getLine() {
        return buffer.toString();
    }

    /**
     * Reset the editor for a new line.
     */
    public void reset() {
        buffer.setLength(0);
        cursorPos = 0;
        state = ParseState.NORMAL;
    }

    /**
     * Process character in NORMAL state.
     */
    private boolean processNormalChar(int ch) throws IOException {
        if (ch == ESC) {
            // Start of escape sequence
            state = ParseState.ESC_SEEN;
            return false;
        }

        if (ch == CR || ch == LF) {
            // Line complete - echo newline and return true
            terminal.write("\r\n".getBytes());
            return true;
        }

        if (ch == BACKSPACE || ch == BACKSPACE_ALT) {
            handleBackspace();
            return false;
        }

        if (ch == CTRL_A) {
            handleBeginningOfLine();
            return false;
        }

        if (ch == CTRL_E) {
            handleEndOfLine();
            return false;
        }

        if (ch == CTRL_B) {
            handleBackwardChar();
            return false;
        }

        if (ch == CTRL_F) {
            handleForwardChar();
            return false;
        }

        if (ch == CTRL_K) {
            handleKillLine();
            return false;
        }

        if (ch == CTRL_D) {
            handleForwardDelete();
            return false;
        }

        // Printable character
        if (ch >= 32 && ch < 127) {
            handlePrintableChar(ch);
            return false;
        }

        // Ignore other control characters
        if (DEBUG) {
            System.err.println("[LineEditor] Ignoring control char: " + ch);
        }
        return false;
    }

    /**
     * Process character in ESC_SEEN state.
     */
    private boolean processEscSeenChar(int ch) throws IOException {
        if (ch == '[') {
            // CSI (Control Sequence Introducer)
            state = ParseState.CSI_SEEN;
            return false;
        }

        // Not a valid escape sequence, treat ESC as literal
        if (DEBUG) {
            System.err.println("[LineEditor] Invalid escape sequence, treating ESC as literal");
        }
        state = ParseState.NORMAL;
        return false;
    }

    /**
     * Process character in CSI_SEEN state.
     */
    private boolean processCsiSeenChar(int ch) throws IOException {
        state = ParseState.NORMAL;

        switch (ch) {
            case 'A': // Up arrow
                if (DEBUG) System.err.println("[LineEditor] Up arrow (not implemented)");
                return false;

            case 'B': // Down arrow
                if (DEBUG) System.err.println("[LineEditor] Down arrow (not implemented)");
                return false;

            case 'C': // Right arrow
                handleForwardChar();
                return false;

            case 'D': // Left arrow
                handleBackwardChar();
                return false;

            default:
                if (DEBUG) {
                    System.err.println("[LineEditor] Unknown CSI sequence: " + ch);
                }
                return false;
        }
    }

    /**
     * Handle printable character insertion.
     */
    private void handlePrintableChar(int ch) throws IOException {
        char c = (char) ch;

        if (cursorPos == buffer.length()) {
            // Append at end - simple case
            buffer.append(c);
            cursorPos++;
            terminal.write(ch);
        } else {
            // Insert in middle - need to redraw
            buffer.insert(cursorPos, c);
            cursorPos++;

            // Write from current position to end (including the char we just inserted)
            terminal.write(buffer.substring(cursorPos - 1).getBytes());

            // Move cursor back to correct position (after the inserted char)
            int charsAfterCursor = buffer.length() - cursorPos;
            for (int i = 0; i < charsAfterCursor; i++) {
                terminal.write(CURSOR_LEFT.getBytes());
            }
        }
    }

    /**
     * Handle backspace key.
     */
    private void handleBackspace() throws IOException {
        if (cursorPos > 0) {
            buffer.deleteCharAt(cursorPos - 1);
            cursorPos--;

            // Move cursor back one position
            terminal.write(CURSOR_LEFT.getBytes());

            // Write everything from current position to end of buffer
            if (cursorPos < buffer.length()) {
                terminal.write(buffer.substring(cursorPos).getBytes());
            }

            // Clear any trailing character
            terminal.write(CLEAR_TO_EOL.getBytes());

            // Move cursor back to correct position
            int charsAfterCursor = buffer.length() - cursorPos;
            for (int i = 0; i < charsAfterCursor; i++) {
                terminal.write(CURSOR_LEFT.getBytes());
            }
        }
    }

    /**
     * Handle CTRL-A (beginning of line).
     */
    private void handleBeginningOfLine() throws IOException {
        while (cursorPos > 0) {
            terminal.write(CURSOR_LEFT.getBytes());
            cursorPos--;
        }
    }

    /**
     * Handle CTRL-E (end of line).
     */
    private void handleEndOfLine() throws IOException {
        while (cursorPos < buffer.length()) {
            terminal.write(CURSOR_RIGHT.getBytes());
            cursorPos++;
        }
    }

    /**
     * Handle CTRL-B (backward one character).
     */
    private void handleBackwardChar() throws IOException {
        if (cursorPos > 0) {
            terminal.write(CURSOR_LEFT.getBytes());
            cursorPos--;
        }
    }

    /**
     * Handle CTRL-F (forward one character).
     */
    private void handleForwardChar() throws IOException {
        if (cursorPos < buffer.length()) {
            terminal.write(CURSOR_RIGHT.getBytes());
            cursorPos++;
        }
    }

    /**
     * Handle CTRL-K (kill to end of line).
     */
    private void handleKillLine() throws IOException {
        if (cursorPos < buffer.length()) {
            buffer.setLength(cursorPos);
            terminal.write(CLEAR_TO_EOL.getBytes());
        }
    }

    /**
     * Handle CTRL-D (forward delete - delete character at cursor).
     */
    private void handleForwardDelete() throws IOException {
        if (cursorPos < buffer.length()) {
            // Delete character at cursor position
            buffer.deleteCharAt(cursorPos);

            // Write everything from current position to end of buffer
            if (cursorPos < buffer.length()) {
                terminal.write(buffer.substring(cursorPos).getBytes());
            }

            // Clear any trailing character
            terminal.write(CLEAR_TO_EOL.getBytes());

            // Move cursor back to correct position (stays at same spot)
            int charsAfterCursor = buffer.length() - cursorPos;
            for (int i = 0; i < charsAfterCursor; i++) {
                terminal.write(CURSOR_LEFT.getBytes());
            }
        }
    }

    /**
     * Redraw the line from the current cursor position.
     * This is used when inserting or deleting in the middle of a line.
     */
    private void redrawFromCursor() throws IOException {
        // Save current position
        int savedPos = cursorPos;

        // Move cursor back to where we need to start redrawing
        // For backspace, we're already one position back
        // For insert, we need to go back one from where we inserted
        int redrawStart = savedPos;
        if (redrawStart > 0) {
            redrawStart--;
        }

        // Move cursor to redraw start
        int stepsBack = cursorPos - redrawStart;
        for (int i = 0; i < stepsBack; i++) {
            terminal.write(CURSOR_LEFT.getBytes());
        }

        // Write from redraw position to end of buffer
        String toRedraw = buffer.substring(redrawStart);
        terminal.write(toRedraw.getBytes());

        // Clear any trailing characters
        terminal.write(CLEAR_TO_EOL.getBytes());

        // Move cursor back to saved position
        int charsAfterCursor = buffer.length() - savedPos;
        for (int i = 0; i < charsAfterCursor; i++) {
            terminal.write(CURSOR_LEFT.getBytes());
        }
    }
}
