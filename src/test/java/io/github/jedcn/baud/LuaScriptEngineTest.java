package io.github.jedcn.baud;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

public class LuaScriptEngineTest {

    private StateManager stateManager;
    private LuaScriptEngine engine;

    @BeforeEach
    public void setUp() {
        stateManager = new StateManager();
        engine = new LuaScriptEngine(null, stateManager);
    }

    @Test
    public void testExecuteLuaCode() throws Exception {
        // Simple Lua code
        engine.executeLuaCode("x = 5 + 3");

        // Code that uses setState
        engine.executeLuaCode("setState('test', 'value')");
        assertEquals("value", stateManager.getState("test"));
    }

    @Test
    public void testSetStateFunction() throws Exception {
        // Test setting different types
        engine.executeLuaCode("setState('str', 'hello')");
        assertEquals("hello", stateManager.getState("str"));

        engine.executeLuaCode("setState('num', 42)");
        assertEquals(42, stateManager.getState("num"));

        engine.executeLuaCode("setState('bool', true)");
        assertEquals(true, stateManager.getState("bool"));

        engine.executeLuaCode("setState('float', 3.14)");
        assertEquals(3.14, stateManager.getState("float"));
    }

    @Test
    public void testGetStateFunction() throws Exception {
        // Set state from Java
        stateManager.setState("key", "value");

        // Get state from Lua and set to another key
        engine.executeLuaCode("local val = getState('key'); setState('result', val)");
        assertEquals("value", stateManager.getState("result"));
    }

    @Test
    public void testGetStateNonExistent() throws Exception {
        // Getting non-existent key should return nil
        engine.executeLuaCode("local val = getState('nonexistent'); setState('result', val == nil)");
        assertEquals(true, stateManager.getState("result"));
    }

    @Test
    public void testSendFunction() throws Exception {
        // Queue a command
        engine.executeLuaCode("send('test command')");

        // Check it was queued
        assertEquals("test command", stateManager.pollAutoResponse());
    }

    @Test
    public void testSendMultiple() throws Exception {
        engine.executeLuaCode("send('cmd1'); send('cmd2'); send('cmd3')");

        assertEquals("cmd1", stateManager.pollAutoResponse());
        assertEquals("cmd2", stateManager.pollAutoResponse());
        assertEquals("cmd3", stateManager.pollAutoResponse());
        assertNull(stateManager.pollAutoResponse());
    }

    @Test
    public void testMatchArray() throws Exception {
        String[] captures = {"100", "200", "John"};

        String luaCode = """
                setState('hp', match[1])
                setState('max', match[2])
                setState('name', match[3])
                """;

        // Create a script file
        Path tempDir = Files.createTempDirectory("lua-test-");
        tempDir.toFile().deleteOnExit();

        Path scriptFile = tempDir.resolve("test.lua");
        Files.writeString(scriptFile, luaCode);
        scriptFile.toFile().deleteOnExit();

        // Create engine with scripts directory
        LuaScriptEngine engineWithScripts = new LuaScriptEngine(tempDir.toString(), stateManager);
        engineWithScripts.loadAllScripts();

        // Execute script with captures
        engineWithScripts.executeScript("test.lua", captures);

        // Verify state was set correctly
        // Note: Lua match array values are strings, but setState stores them as-is
        assertEquals(100, stateManager.getState("hp"));
        assertEquals(200, stateManager.getState("max"));
        assertEquals("John", stateManager.getState("name"));
    }

    @Test
    public void testLoadAllScripts() throws Exception {
        // Create temp directory with scripts
        Path tempDir = Files.createTempDirectory("lua-test-");
        tempDir.toFile().deleteOnExit();

        Path script1 = tempDir.resolve("script1.lua");
        Files.writeString(script1, "setState('s1', 'loaded')");
        script1.toFile().deleteOnExit();

        Path script2 = tempDir.resolve("script2.lua");
        Files.writeString(script2, "setState('s2', 'loaded')");
        script2.toFile().deleteOnExit();

        // Create engine and load scripts
        LuaScriptEngine engineWithScripts = new LuaScriptEngine(tempDir.toString(), stateManager);
        engineWithScripts.loadAllScripts();

        assertEquals(2, engineWithScripts.getScriptCount());
    }

    @Test
    public void testLoadScriptsInvalidDirectory() {
        LuaScriptEngine engineWithBadDir = new LuaScriptEngine("/nonexistent/dir", stateManager);

        assertThrows(IOException.class, () -> {
            engineWithBadDir.loadAllScripts();
        });
    }

    @Test
    public void testExecuteScript() throws Exception {
        // Create temp directory with script
        Path tempDir = Files.createTempDirectory("lua-test-");
        tempDir.toFile().deleteOnExit();

        String luaCode = """
                local hp = tonumber(match[1])
                local max = tonumber(match[2])
                setState('hp_current', hp)
                setState('hp_max', max)
                if hp / max < 0.3 then
                    send('heal')
                end
                """;

        Path scriptFile = tempDir.resolve("health.lua");
        Files.writeString(scriptFile, luaCode);
        scriptFile.toFile().deleteOnExit();

        // Create engine and load scripts
        LuaScriptEngine engineWithScripts = new LuaScriptEngine(tempDir.toString(), stateManager);
        engineWithScripts.loadAllScripts();

        // Execute with low health
        String[] captures = {"25", "100"};
        engineWithScripts.executeScript("health.lua", captures);

        assertEquals(25, stateManager.getState("hp_current"));
        assertEquals(100, stateManager.getState("hp_max"));
        assertEquals("heal", stateManager.pollAutoResponse());
    }

    @Test
    public void testExecuteScriptNotFound() throws Exception {
        Exception exception = assertThrows(Exception.class, () -> {
            engine.executeScript("nonexistent.lua", new String[]{});
        });

        assertTrue(exception.getMessage().contains("not found"));
    }

    @Test
    public void testLuaError() {
        Exception exception = assertThrows(Exception.class, () -> {
            engine.executeLuaCode("this is invalid lua syntax !!!!");
        });

        assertTrue(exception.getMessage().contains("Lua error"));
    }

    @Test
    public void testLuaRuntimeError() {
        Exception exception = assertThrows(Exception.class, () -> {
            engine.executeLuaCode("error('intentional error')");
        });

        assertTrue(exception.getMessage().contains("Lua error"));
    }

    @Test
    public void testConcurrentExecution() throws Exception {
        int numThreads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch latch = new CountDownLatch(numThreads);
        List<Exception> exceptions = new ArrayList<>();

        for (int i = 0; i < numThreads; i++) {
            final int threadNum = i;
            executor.submit(() -> {
                try {
                    engine.executeLuaCode("setState('thread" + threadNum + "', " + threadNum + ")");
                } catch (Exception e) {
                    synchronized (exceptions) {
                        exceptions.add(e);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        // Wait for all threads to complete
        assertTrue(latch.await(5, TimeUnit.SECONDS));
        executor.shutdown();

        // Check no exceptions occurred
        assertTrue(exceptions.isEmpty(), "Concurrent execution should not throw exceptions");

        // Verify all values were set
        for (int i = 0; i < numThreads; i++) {
            assertEquals(i, stateManager.getState("thread" + i),
                       "Thread " + i + " state should be set");
        }
    }

    @Test
    public void testScriptWithConditionals() throws Exception {
        String luaCode = """
                local planet = getState('target_planet')
                if planet == 5 then
                    send('land on planet 5')
                elseif planet == 3 then
                    send('land on planet 3')
                else
                    send('continue scanning')
                end
                """;

        // Test with planet 5
        stateManager.setState("target_planet", 5);
        engine.executeLuaCode(luaCode);
        assertEquals("land on planet 5", stateManager.pollAutoResponse());

        // Test with planet 3
        stateManager.setState("target_planet", 3);
        engine.executeLuaCode(luaCode);
        assertEquals("land on planet 3", stateManager.pollAutoResponse());

        // Test with other planet
        stateManager.setState("target_planet", 7);
        engine.executeLuaCode(luaCode);
        assertEquals("continue scanning", stateManager.pollAutoResponse());
    }

    @Test
    public void testStatePersistenceAcrossExecutions() throws Exception {
        // First execution sets state
        engine.executeLuaCode("setState('counter', 1)");
        assertEquals(1, stateManager.getState("counter"));

        // Second execution increments
        engine.executeLuaCode("local c = getState('counter'); setState('counter', c + 1)");
        assertEquals(2, stateManager.getState("counter"));

        // Third execution increments again
        engine.executeLuaCode("local c = getState('counter'); setState('counter', c + 1)");
        assertEquals(3, stateManager.getState("counter"));
    }

    @Test
    public void testLuaStringConcatenation() throws Exception {
        stateManager.setState("name", "John");
        engine.executeLuaCode("local name = getState('name'); setState('greeting', 'Hello ' .. name)");
        assertEquals("Hello John", stateManager.getState("greeting"));
    }

    @Test
    public void testLuaMathOperations() throws Exception {
        engine.executeLuaCode("""
                setState('sum', 10 + 5)
                setState('product', 10 * 5)
                setState('division', 10 / 5)
                setState('modulo', 10 % 3)
                """);

        assertEquals(15, stateManager.getState("sum"));
        assertEquals(50, stateManager.getState("product"));
        assertEquals(2, stateManager.getState("division")); // Lua returns integer when result is whole
        assertEquals(1, stateManager.getState("modulo"));
    }
}
