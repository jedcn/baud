package io.github.jedcn.baud;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Manages state variables and pattern-based triggers for Lua scripts.
 * Thread-safe for use by both the main thread and BBS reader thread.
 */
public class StateManager {

    private static final boolean DEBUG = "true".equalsIgnoreCase(System.getenv("DEBUG"));

    // Thread-safe state storage
    private final Map<String, Object> state;

    // Auto-response queue for commands from Lua scripts
    private final LinkedBlockingQueue<String> autoResponseQueue;

    // Pattern registry
    private final List<PatternEntry> patterns;

    // Reference to LuaScriptEngine for triggering scripts
    private LuaScriptEngine luaScriptEngine;

    public StateManager() {
        this.state = new ConcurrentHashMap<>();
        this.autoResponseQueue = new LinkedBlockingQueue<>();
        this.patterns = new ArrayList<>();
    }

    /**
     * Set the LuaScriptEngine reference.
     * Called by LuaScriptEngine after construction.
     */
    public void setLuaScriptEngine(LuaScriptEngine engine) {
        this.luaScriptEngine = engine;
    }

    /**
     * Set a state variable (thread-safe).
     */
    public void setState(String key, Object value) {
        state.put(key, value);
        if (DEBUG) {
            System.err.println("[StateManager] Set state: '" + key + "' = " + value);
        }
    }

    /**
     * Get a state variable (thread-safe).
     */
    public Object getState(String key) {
        return state.get(key);
    }

    /**
     * Queue an auto-response command to be sent to the BBS.
     * Called by Lua scripts via send() function.
     */
    public void queueAutoResponse(String command) {
        if (command != null && !command.isEmpty()) {
            autoResponseQueue.offer(command);
            if (DEBUG) {
                System.err.println("[StateManager] Queued auto-response: " + command);
            }
        }
    }

    /**
     * Poll for the next auto-response (non-blocking).
     * Called by main thread.
     */
    public String pollAutoResponse() {
        return autoResponseQueue.poll();
    }

    /**
     * Load patterns from a file.
     * File format: REGEX | SCRIPT_NAME | COMMENT
     * Lines starting with # are comments.
     *
     * @param filePath Path to patterns file
     * @throws IOException If file cannot be read
     */
    public void loadPatternsFromFile(String filePath) throws IOException {
        if (DEBUG) {
            System.err.println("[StateManager] Loading patterns from: " + filePath);
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

                // Parse "REGEX | SCRIPT | COMMENT" format
                String[] parts = trimmed.split("\\|");
                if (parts.length < 2) {
                    if (DEBUG) {
                        System.err.println("[StateManager] Warning: Line " + lineNumber +
                                         " missing separator, skipping: " + line);
                    }
                    continue;
                }

                String regex = parts[0].trim();
                String scriptName = parts[1].trim();
                String comment = parts.length > 2 ? parts[2].trim() : "";

                if (regex.isEmpty() || scriptName.isEmpty()) {
                    if (DEBUG) {
                        System.err.println("[StateManager] Warning: Line " + lineNumber +
                                         " has empty regex or script, skipping: " + line);
                    }
                    continue;
                }

                try {
                    Pattern pattern = Pattern.compile(regex);
                    patterns.add(new PatternEntry(pattern, scriptName, comment));
                    loadedCount++;

                    if (DEBUG) {
                        System.err.println("[StateManager] Loaded pattern: '" + regex +
                                         "' -> " + scriptName + " (" + comment + ")");
                    }
                } catch (Exception e) {
                    System.err.println("[StateManager] Warning: Line " + lineNumber +
                                     " has invalid regex: " + regex + " - " + e.getMessage());
                }
            }
        }

        if (DEBUG) {
            System.err.println("[StateManager] Loaded " + loadedCount + " patterns from " + filePath);
        }
    }

    /**
     * Process text from BBS, checking for pattern matches.
     * Called by BBS reader thread.
     *
     * @param text Text received from BBS
     */
    public void processText(String text) {
        if (luaScriptEngine == null || patterns.isEmpty()) {
            return;
        }

        for (PatternEntry entry : patterns) {
            Matcher matcher = entry.pattern.matcher(text);
            if (matcher.find()) {
                // Extract capture groups
                String[] captures = new String[matcher.groupCount()];
                for (int i = 0; i < matcher.groupCount(); i++) {
                    captures[i] = matcher.group(i + 1);
                }

                if (DEBUG) {
                    System.err.println("[StateManager] Pattern matched: " + entry.pattern.pattern() +
                                     " -> " + entry.scriptName);
                }

                // Execute the associated script
                try {
                    luaScriptEngine.executeScript(entry.scriptName, captures);
                } catch (Exception e) {
                    System.err.println("[StateManager] Error executing script " +
                                     entry.scriptName + ": " + e.getMessage());
                    if (DEBUG) {
                        e.printStackTrace(System.err);
                    }
                }
            }
        }
    }

    /**
     * Get the number of loaded patterns.
     */
    public int getPatternCount() {
        return patterns.size();
    }

    /**
     * Internal class to hold pattern entries.
     */
    private static class PatternEntry {
        final Pattern pattern;
        final String scriptName;
        final String comment;

        PatternEntry(Pattern pattern, String scriptName, String comment) {
            this.pattern = pattern;
            this.scriptName = scriptName;
            this.comment = comment;
        }
    }
}
