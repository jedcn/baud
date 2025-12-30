package io.github.jedcn.baud;

import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;
import picocli.CommandLine.Option;

import java.util.concurrent.Callable;

@Command(
    name = "baud",
    version = "1.0",
    description = "Connect to a Bulletin Board System (BBS) via telnet",
    mixinStandardHelpOptions = true
)
public class BaudCli implements Callable<Integer> {

    @Parameters(
        index = "0",
        description = "The hostname or IP address of the BBS"
    )
    private String host;

    @Parameters(
        index = "1",
        defaultValue = "23",
        description = "The port number (default: 23)"
    )
    private int port;

    @Option(
        names = {"-t", "--timeout"},
        description = "Connection timeout in seconds (default: 30)",
        defaultValue = "30"
    )
    private int timeout;

    @Override
    public Integer call() throws Exception {
        System.out.println("Connecting to " + host + ":" + port + "...");

        try (TerminalHandler terminalHandler = new TerminalHandler();
             TelnetSession telnetSession = new TelnetSession()) {

            // Connect to the BBS
            telnetSession.connect(host, port, timeout);
            System.out.println("Connected! Press Ctrl+] followed by 'quit' to disconnect.");

            // Start the session
            SessionManager sessionManager = new SessionManager(terminalHandler, telnetSession);
            sessionManager.run();

            System.out.println("\nDisconnected from " + host);
            return 0;

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            return 1;
        }
    }

    public static void main(String[] args) {
        int exitCode = new CommandLine(new BaudCli()).execute(args);
        System.exit(exitCode);
    }
}
