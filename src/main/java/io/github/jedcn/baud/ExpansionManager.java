package io.github.jedcn.baud;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Manages text expansions for the BBS client.
 * Allows users to define shortcuts that expand to longer text when Enter is pressed.
 *
 * File format:
 * # Comments start with #
 * shortcut=expansion text
 *
 * Example:
 * scapl1=sca pl 1
 * tp=teleport
 * inv=inventory
 */
public class ExpansionManager {

    private static final boolean DEBUG = "true".equalsIgnoreCase(System.getenv("DEBUG"));

    private final Map<String, String> expansions;

    public ExpansionManager() {
        this.expansions = new HashMap<>();
    }

    /**
     * Load expansions from a file.
     *
     * @param filePath Path to the expansions file
     * @throws IOException If the file cannot be read
     */
    public void loadFromFile(String filePath) throws IOException {
        if (DEBUG) {
            System.err.println("[ExpansionManager] Loading expansions from: " + filePath);
        }

        int lineNumber = 0;
        int loadedCount = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;

                // Skip empty lines and comments
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }

                // Parse "key=value" format
                int equalsIndex = trimmed.indexOf('=');
                if (equalsIndex == -1) {
                    if (DEBUG) {
                        System.err.println("[ExpansionManager] Warning: Line " + lineNumber +
                                         " has no '=' separator, skipping: " + line);
                    }
                    continue;
                }

                String key = trimmed.substring(0, equalsIndex).trim();
                String value = trimmed.substring(equalsIndex + 1).trim();

                if (key.isEmpty()) {
                    if (DEBUG) {
                        System.err.println("[ExpansionManager] Warning: Line " + lineNumber +
                                         " has empty key, skipping: " + line);
                    }
                    continue;
                }

                // Allow empty values (key can expand to empty string)
                expansions.put(key, value);
                loadedCount++;

                if (DEBUG) {
                    System.err.println("[ExpansionManager] Loaded expansion: '" + key + "' -> '" + value + "'");
                }
            }
        }

        if (DEBUG) {
            System.err.println("[ExpansionManager] Loaded " + loadedCount + " expansions from " + filePath);
        }
    }

    /**
     * Expand a text string if it matches a defined expansion.
     * If no expansion is found, returns the original text.
     *
     * @param text The text to potentially expand
     * @return The expanded text, or the original if no expansion exists
     */
    public String expand(String text) {
        String expanded = expansions.getOrDefault(text, text);

        if (DEBUG && !expanded.equals(text)) {
            System.err.println("[ExpansionManager] Expanded '" + text + "' -> '" + expanded + "'");
        }

        return expanded;
    }

    /**
     * Get the number of loaded expansions.
     *
     * @return The number of expansions
     */
    public int size() {
        return expansions.size();
    }

    /**
     * Check if an expansion exists for the given text.
     *
     * @param text The text to check
     * @return true if an expansion exists, false otherwise
     */
    public boolean hasExpansion(String text) {
        return expansions.containsKey(text);
    }

    /**
     * Clear all loaded expansions.
     */
    public void clear() {
        expansions.clear();
    }
}
