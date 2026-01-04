package io.github.jedcn.baud;

import org.luaj.vm2.Globals;
import org.luaj.vm2.LuaError;
import org.luaj.vm2.LuaTable;
import org.luaj.vm2.LuaValue;
import org.luaj.vm2.lib.jse.CoerceJavaToLua;
import org.luaj.vm2.lib.jse.JsePlatform;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.stream.Stream;

/**
 * Wrapper around LuaJ for executing Lua scripts.
 * Provides thread-safe script execution and exposes Java functions to Lua.
 */
public class LuaScriptEngine {

    private static final boolean DEBUG = "true".equalsIgnoreCase(System.getenv("DEBUG"));

    private final String scriptsDirectory;
    private final StateManager stateManager;
    private final Globals globals;
    private final Map<String, String> loadedScripts;
    private final ReentrantReadWriteLock lock;

    /**
     * Create a new LuaScriptEngine.
     *
     * @param scriptsDirectory Directory containing .lua script files (can be null)
     * @param stateManager StateManager for state storage and auto-responses
     */
    public LuaScriptEngine(String scriptsDirectory, StateManager stateManager) {
        this.scriptsDirectory = scriptsDirectory;
        this.stateManager = stateManager;
        this.loadedScripts = new HashMap<>();
        this.lock = new ReentrantReadWriteLock();

        // Initialize Lua globals with standard libraries
        this.globals = JsePlatform.standardGlobals();

        // Set up the StateManager reference in StateManager
        stateManager.setLuaScriptEngine(this);

        // Expose Java functions to Lua
        setupLuaAPI();

        if (DEBUG) {
            System.err.println("[LuaScriptEngine] Initialized with scripts directory: " + scriptsDirectory);
        }
    }

    /**
     * Set up the Lua API by exposing Java functions.
     */
    private void setupLuaAPI() {
        // setState(key, value) - Set a state variable
        globals.set("setState", new org.luaj.vm2.lib.TwoArgFunction() {
            @Override
            public LuaValue call(LuaValue key, LuaValue value) {
                String keyStr = key.tojstring();
                Object valueObj = convertLuaToJava(value);
                stateManager.setState(keyStr, valueObj);
                return LuaValue.NIL;
            }
        });

        // getState(key) - Get a state variable
        globals.set("getState", new org.luaj.vm2.lib.OneArgFunction() {
            @Override
            public LuaValue call(LuaValue key) {
                String keyStr = key.tojstring();
                Object value = stateManager.getState(keyStr);
                return convertJavaToLua(value);
            }
        });

        // send(text) - Queue an auto-response
        globals.set("send", new org.luaj.vm2.lib.OneArgFunction() {
            @Override
            public LuaValue call(LuaValue text) {
                String textStr = text.tojstring();
                stateManager.queueAutoResponse(textStr);
                return LuaValue.NIL;
            }
        });
    }

    /**
     * Load all .lua scripts from the scripts directory.
     */
    public void loadAllScripts() throws IOException {
        if (scriptsDirectory == null) {
            return;
        }

        Path dir = Paths.get(scriptsDirectory);
        if (!Files.exists(dir) || !Files.isDirectory(dir)) {
            throw new IOException("Scripts directory does not exist: " + scriptsDirectory);
        }

        if (DEBUG) {
            System.err.println("[LuaScriptEngine] Loading scripts from: " + scriptsDirectory);
        }

        try (Stream<Path> paths = Files.walk(dir)) {
            paths.filter(Files::isRegularFile)
                 .filter(p -> p.toString().endsWith(".lua"))
                 .forEach(path -> {
                     try {
                         String scriptName = path.getFileName().toString();
                         String scriptContent = Files.readString(path);
                         loadedScripts.put(scriptName, scriptContent);

                         if (DEBUG) {
                             System.err.println("[LuaScriptEngine] Loaded script: " + scriptName);
                         }
                     } catch (IOException e) {
                         System.err.println("[LuaScriptEngine] Warning: Could not load script " +
                                          path.getFileName() + ": " + e.getMessage());
                     }
                 });
        }

        if (DEBUG) {
            System.err.println("[LuaScriptEngine] Loaded " + loadedScripts.size() + " scripts");
        }
    }

    /**
     * Execute a loaded script with capture groups from pattern matching.
     *
     * @param scriptName Name of the script (e.g., "health_monitor.lua")
     * @param captures Array of regex capture groups
     * @throws Exception If script execution fails
     */
    public void executeScript(String scriptName, String[] captures) throws Exception {
        String scriptContent = loadedScripts.get(scriptName);
        if (scriptContent == null) {
            throw new Exception("Script not found: " + scriptName);
        }

        lock.writeLock().lock();
        try {
            // Set up match[] array with capture groups
            LuaTable matchTable = new LuaTable();
            for (int i = 0; i < captures.length; i++) {
                matchTable.set(i + 1, captures[i]); // Lua arrays are 1-indexed
            }
            globals.set("match", matchTable);

            if (DEBUG) {
                System.err.println("[LuaScriptEngine] Executing script: " + scriptName +
                                 " with " + captures.length + " captures");
            }

            // Execute the script
            globals.load(scriptContent, scriptName).call();

        } catch (LuaError e) {
            throw new Exception("Lua error in " + scriptName + ": " + e.getMessage(), e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Execute inline Lua code (from /lua commands).
     *
     * @param code Lua code to execute
     * @throws Exception If execution fails
     */
    public void executeLuaCode(String code) throws Exception {
        lock.writeLock().lock();
        try {
            if (DEBUG) {
                System.err.println("[LuaScriptEngine] Executing inline code: " + code);
            }

            globals.load(code, "inline").call();

        } catch (LuaError e) {
            throw new Exception("Lua error: " + e.getMessage(), e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Get the number of loaded scripts.
     */
    public int getScriptCount() {
        return loadedScripts.size();
    }

    /**
     * Convert Lua value to Java object.
     */
    private Object convertLuaToJava(LuaValue value) {
        if (value.isnil()) {
            return null;
        } else if (value.isboolean()) {
            return value.toboolean();
        } else if (value.isint()) {
            return value.toint();
        } else if (value.isnumber()) {
            return value.todouble();
        } else if (value.isstring()) {
            return value.tojstring();
        } else {
            return value.toString();
        }
    }

    /**
     * Convert Java object to Lua value.
     */
    private LuaValue convertJavaToLua(Object obj) {
        if (obj == null) {
            return LuaValue.NIL;
        } else if (obj instanceof Boolean) {
            return LuaValue.valueOf((Boolean) obj);
        } else if (obj instanceof Integer) {
            return LuaValue.valueOf((Integer) obj);
        } else if (obj instanceof Long) {
            return LuaValue.valueOf((Long) obj);
        } else if (obj instanceof Double) {
            return LuaValue.valueOf((Double) obj);
        } else if (obj instanceof String) {
            return LuaValue.valueOf((String) obj);
        } else {
            return CoerceJavaToLua.coerce(obj);
        }
    }
}
