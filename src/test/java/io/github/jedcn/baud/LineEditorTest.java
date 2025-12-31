package io.github.jedcn.baud;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class LineEditorTest {

    private MockTerminalHandler mockTerminal;
    private LineEditor lineEditor;

    @BeforeEach
    public void setUp() {
        mockTerminal = new MockTerminalHandler();
        lineEditor = new LineEditor(mockTerminal);
    }

    @Test
    public void testSimpleCharacterInput() throws IOException {
        // Type "hello"
        assertFalse(lineEditor.processChar('h'));
        assertFalse(lineEditor.processChar('e'));
        assertFalse(lineEditor.processChar('l'));
        assertFalse(lineEditor.processChar('l'));
        assertFalse(lineEditor.processChar('o'));

        // Verify line not complete yet
        assertEquals("hello", lineEditor.getLine());
    }

    @Test
    public void testEnterCompletesLine() throws IOException {
        // Type "hello" and press Enter
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        boolean lineComplete = lineEditor.processChar('\r');
        assertTrue(lineComplete, "Enter should complete the line");
        assertEquals("hello", lineEditor.getLine());
    }

    @Test
    public void testBackspaceAtEnd() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Backspace once
        lineEditor.processChar(127); // Backspace

        // Verify 'o' was deleted
        assertEquals("hell", lineEditor.getLine());
    }

    @Test
    public void testBackspaceInMiddle() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move left twice (cursor is now after "hel", before second "l")
        lineEditor.processChar(2); // CTRL-B
        lineEditor.processChar(2); // CTRL-B

        // Backspace (deletes first 'l')
        lineEditor.processChar(127);

        // Should have deleted the first 'l', leaving "helo"
        assertEquals("helo", lineEditor.getLine());
    }

    @Test
    public void testCtrlD_ForwardDelete() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move to beginning
        lineEditor.processChar(1); // CTRL-A

        // Forward delete (should delete 'h')
        lineEditor.processChar(4); // CTRL-D

        assertEquals("ello", lineEditor.getLine());
    }

    @Test
    public void testCtrlA_MoveToBeginning() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move to beginning
        lineEditor.processChar(1); // CTRL-A

        // Type 'X' - should insert at beginning
        lineEditor.processChar('X');

        assertEquals("Xhello", lineEditor.getLine());
    }

    @Test
    public void testCtrlE_MoveToEnd() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move to beginning
        lineEditor.processChar(1); // CTRL-A

        // Move to end
        lineEditor.processChar(5); // CTRL-E

        // Type 'X' - should append at end
        lineEditor.processChar('X');

        assertEquals("helloX", lineEditor.getLine());
    }

    @Test
    public void testCtrlB_MoveBackward() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move back one
        lineEditor.processChar(2); // CTRL-B

        // Type 'X' - should insert before 'o'
        lineEditor.processChar('X');

        assertEquals("hellXo", lineEditor.getLine());
    }

    @Test
    public void testCtrlF_MoveForward() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move to beginning
        lineEditor.processChar(1); // CTRL-A

        // Move forward two
        lineEditor.processChar(6); // CTRL-F
        lineEditor.processChar(6); // CTRL-F

        // Type 'X' - should insert after "he"
        lineEditor.processChar('X');

        assertEquals("heXllo", lineEditor.getLine());
    }

    @Test
    public void testCtrlK_KillToEnd() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move to position 2 (after "he")
        lineEditor.processChar(1); // CTRL-A
        lineEditor.processChar(6); // CTRL-F
        lineEditor.processChar(6); // CTRL-F

        // Kill to end
        lineEditor.processChar(11); // CTRL-K

        assertEquals("he", lineEditor.getLine());
    }

    @Test
    public void testArrowKeys() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Simulate left arrow key: ESC [ D
        lineEditor.processChar(27); // ESC
        lineEditor.processChar('[');
        lineEditor.processChar('D');

        // Type 'X' - should insert before 'o'
        lineEditor.processChar('X');

        assertEquals("hellXo", lineEditor.getLine());
    }

    @Test
    public void testReset() throws IOException {
        // Type "hello"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        assertEquals("hello", lineEditor.getLine());

        // Reset
        lineEditor.reset();

        // Should be empty now
        assertEquals("", lineEditor.getLine());

        // Type new text
        lineEditor.processChar('b');
        lineEditor.processChar('y');
        lineEditor.processChar('e');

        assertEquals("bye", lineEditor.getLine());
    }

    @Test
    public void testInsertInMiddle() throws IOException {
        // Type "helo"
        lineEditor.processChar('h');
        lineEditor.processChar('e');
        lineEditor.processChar('l');
        lineEditor.processChar('o');

        // Move back two positions
        lineEditor.processChar(2); // CTRL-B
        lineEditor.processChar(2); // CTRL-B

        // Insert 'l' (to make "hello")
        lineEditor.processChar('l');

        assertEquals("hello", lineEditor.getLine());
    }

    /**
     * Mock TerminalHandler for testing.
     * Captures all write operations for verification without creating a real terminal.
     */
    private static class MockTerminalHandler implements TerminalWriter {
        private final List<String> writtenData = new ArrayList<>();
        private final List<Integer> writtenBytes = new ArrayList<>();

        public void write(byte[] data) throws IOException {
            writtenData.add(new String(data));
        }

        public void write(byte[] data, int offset, int length) throws IOException {
            writtenData.add(new String(data, offset, length));
        }

        public void write(int b) throws IOException {
            writtenBytes.add(b);
        }

        public List<String> getWrittenData() {
            return writtenData;
        }

        public List<Integer> getWrittenBytes() {
            return writtenBytes;
        }

        public void clear() {
            writtenData.clear();
            writtenBytes.clear();
        }
    }
}
