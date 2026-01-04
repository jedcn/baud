package io.github.jedcn.baud;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class StateManagerTest {

    private StateManager manager;

    @BeforeEach
    public void setUp() {
        manager = new StateManager();
    }

    @Test
    public void testStateGetAndSet() {
        // Test basic get and set
        manager.setState("key1", "value1");
        assertEquals("value1", manager.getState("key1"));

        // Test different types
        manager.setState("intKey", 42);
        assertEquals(42, manager.getState("intKey"));

        manager.setState("doubleKey", 3.14);
        assertEquals(3.14, manager.getState("doubleKey"));

        manager.setState("boolKey", true);
        assertEquals(true, manager.getState("boolKey"));
    }

    @Test
    public void testGetNonExistentKey() {
        assertNull(manager.getState("nonexistent"));
    }

    @Test
    public void testStateOverwrite() {
        manager.setState("key", "value1");
        assertEquals("value1", manager.getState("key"));

        manager.setState("key", "value2");
        assertEquals("value2", manager.getState("key"));
    }

    @Test
    public void testAutoResponseQueue() {
        // Queue should be empty initially
        assertNull(manager.pollAutoResponse());

        // Queue a response
        manager.queueAutoResponse("command1");
        assertEquals("command1", manager.pollAutoResponse());

        // Should be empty after poll
        assertNull(manager.pollAutoResponse());
    }

    @Test
    public void testAutoResponseQueueMultiple() {
        // Queue multiple responses
        manager.queueAutoResponse("command1");
        manager.queueAutoResponse("command2");
        manager.queueAutoResponse("command3");

        // Should come out in FIFO order
        assertEquals("command1", manager.pollAutoResponse());
        assertEquals("command2", manager.pollAutoResponse());
        assertEquals("command3", manager.pollAutoResponse());
        assertNull(manager.pollAutoResponse());
    }

    @Test
    public void testAutoResponseQueueIgnoresEmpty() {
        manager.queueAutoResponse("");
        manager.queueAutoResponse(null);

        // Empty and null should not be queued
        assertNull(manager.pollAutoResponse());
    }

    @Test
    public void testLoadPatternsFromFile() throws IOException {
        String content = """
                # This is a comment
                Your health: (\\d+)/(\\d+) | health_monitor.lua | Track health
                Planet (\\d+) | planet_scan.lua | Record planet
                """;
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());

        assertEquals(2, manager.getPatternCount());
    }

    @Test
    public void testLoadPatternsIgnoresComments() throws IOException {
        String content = """
                # Comment line
                Pattern1 | script1.lua | Test
                # Another comment
                Pattern2 | script2.lua | Test
                """;
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());

        assertEquals(2, manager.getPatternCount());
    }

    @Test
    public void testLoadPatternsIgnoresEmptyLines() throws IOException {
        String content = """
                Pattern1 | script1.lua | Test

                Pattern2 | script2.lua | Test

                """;
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());

        assertEquals(2, manager.getPatternCount());
    }

    @Test
    public void testLoadPatternsInvalidFormat() throws IOException {
        String content = """
                ValidPattern | script.lua | Comment
                InvalidLineWithoutPipe
                AnotherValid | script2.lua | Comment
                """;
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());

        // Should skip invalid line
        assertEquals(2, manager.getPatternCount());
    }

    @Test
    public void testLoadPatternsEmptyFields() throws IOException {
        String content = """
                ValidPattern | script.lua | Comment
                 | script.lua | Empty regex
                Pattern | | Empty script
                """;
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());

        // Should skip lines with empty fields
        assertEquals(1, manager.getPatternCount());
    }

    @Test
    public void testLoadPatternsInvalidRegex() throws IOException {
        String content = """
                ValidPattern | script.lua | Comment
                [Invalid(Regex | script.lua | Bad regex
                """;
        Path tempFile = createTempFile(content);

        // Should not throw, just log warning
        manager.loadPatternsFromFile(tempFile.toString());

        // Should only load valid pattern
        assertEquals(1, manager.getPatternCount());
    }

    @Test
    public void testLoadPatternsFileNotFound() {
        assertThrows(IOException.class, () -> {
            manager.loadPatternsFromFile("/nonexistent/file/path.txt");
        });
    }

    @Test
    public void testLoadPatternsOptionalComment() throws IOException {
        String content = "Pattern | script.lua\n";
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());

        assertEquals(1, manager.getPatternCount());
    }

    @Test
    public void testProcessTextWithoutEngine() throws IOException {
        // Should not throw when LuaScriptEngine is not set
        String content = "Health: (\\d+) | script.lua | Test\n";
        Path tempFile = createTempFile(content);

        manager.loadPatternsFromFile(tempFile.toString());
        manager.processText("Health: 100");

        // Should do nothing without engine
        assertNull(manager.pollAutoResponse());
    }

    @Test
    public void testProcessTextWithoutPatterns() {
        // Should not throw when no patterns loaded
        manager.processText("Some text");

        assertNull(manager.pollAutoResponse());
    }

    /**
     * Helper method to create a temporary file with given content.
     */
    private Path createTempFile(String content) throws IOException {
        Path tempFile = Files.createTempFile("patterns-test-", ".txt");
        tempFile.toFile().deleteOnExit();
        Files.writeString(tempFile, content);
        return tempFile;
    }
}
