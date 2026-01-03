package io.github.jedcn.baud;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class ExpansionManagerTest {

    private ExpansionManager manager;

    @BeforeEach
    public void setUp() {
        manager = new ExpansionManager();
    }

    @Test
    public void testSimpleExpansion() throws IOException {
        // Create a simple expansions file
        String content = "tp=teleport\ninv=inventory\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("teleport", manager.expand("tp"));
        assertEquals("inventory", manager.expand("inv"));
    }

    @Test
    public void testExpansionWithSpaces() throws IOException {
        String content = "scapl1=sca pl 1\nscapl2=sca pl 2\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("sca pl 1", manager.expand("scapl1"));
        assertEquals("sca pl 2", manager.expand("scapl2"));
    }

    @Test
    public void testNoExpansionReturnsOriginal() throws IOException {
        String content = "tp=teleport\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("unknown", manager.expand("unknown"));
        assertEquals("teleport command", manager.expand("teleport command"));
    }

    @Test
    public void testCommentsAreIgnored() throws IOException {
        String content = """
                # This is a comment
                tp=teleport
                # Another comment
                inv=inventory
                """;
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals(2, manager.size());
        assertEquals("teleport", manager.expand("tp"));
        assertEquals("inventory", manager.expand("inv"));
    }

    @Test
    public void testEmptyLinesAreIgnored() throws IOException {
        String content = """
                tp=teleport

                inv=inventory

                """;
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals(2, manager.size());
    }

    @Test
    public void testWhitespaceIsTrimmed() throws IOException {
        String content = "  tp  =  teleport  \n  inv  =  inventory  \n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("teleport", manager.expand("tp"));
        assertEquals("inventory", manager.expand("inv"));
    }

    @Test
    public void testEmptyValue() throws IOException {
        String content = "clear=\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("", manager.expand("clear"));
        assertEquals(1, manager.size());
    }

    @Test
    public void testMultipleEqualsInValue() throws IOException {
        String content = "eq=a=b=c\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("a=b=c", manager.expand("eq"));
    }

    @Test
    public void testInvalidLineWithoutEquals() throws IOException {
        String content = """
                tp=teleport
                invalid line without equals
                inv=inventory
                """;
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        // Should skip invalid line and load the other two
        assertEquals(2, manager.size());
        assertEquals("teleport", manager.expand("tp"));
        assertEquals("inventory", manager.expand("inv"));
    }

    @Test
    public void testEmptyKey() throws IOException {
        String content = """
                tp=teleport
                =empty key
                inv=inventory
                """;
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        // Should skip line with empty key
        assertEquals(2, manager.size());
    }

    @Test
    public void testHasExpansion() throws IOException {
        String content = "tp=teleport\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertTrue(manager.hasExpansion("tp"));
        assertFalse(manager.hasExpansion("inv"));
        assertFalse(manager.hasExpansion("unknown"));
    }

    @Test
    public void testClear() throws IOException {
        String content = "tp=teleport\ninv=inventory\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());
        assertEquals(2, manager.size());

        manager.clear();
        assertEquals(0, manager.size());
        assertFalse(manager.hasExpansion("tp"));
    }

    @Test
    public void testSize() throws IOException {
        assertEquals(0, manager.size());

        String content = "tp=teleport\ninv=inventory\nlook=l\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());
        assertEquals(3, manager.size());
    }

    @Test
    public void testOverwriteDuplicateKeys() throws IOException {
        String content = """
                tp=teleport
                tp=transport
                """;
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        // Second definition should overwrite first
        assertEquals("transport", manager.expand("tp"));
        assertEquals(1, manager.size());
    }

    @Test
    public void testSpecialCharactersInValue() throws IOException {
        String content = "emoji=Hello 🌍!\nspecial=!@#$%^&*()\n";
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals("Hello 🌍!", manager.expand("emoji"));
        assertEquals("!@#$%^&*()", manager.expand("special"));
    }

    @Test
    public void testFileNotFound() {
        assertThrows(IOException.class, () -> {
            manager.loadFromFile("/nonexistent/file/path.txt");
        });
    }

    @Test
    public void testEmptyFile() throws IOException {
        Path tempFile = createTempFile("");

        manager.loadFromFile(tempFile.toString());

        assertEquals(0, manager.size());
    }

    @Test
    public void testCommentOnlyFile() throws IOException {
        String content = """
                # Comment 1
                # Comment 2
                # Comment 3
                """;
        Path tempFile = createTempFile(content);

        manager.loadFromFile(tempFile.toString());

        assertEquals(0, manager.size());
    }

    /**
     * Helper method to create a temporary file with given content.
     */
    private Path createTempFile(String content) throws IOException {
        Path tempFile = Files.createTempFile("expansions-test-", ".txt");
        tempFile.toFile().deleteOnExit();
        Files.writeString(tempFile, content);
        return tempFile;
    }
}
