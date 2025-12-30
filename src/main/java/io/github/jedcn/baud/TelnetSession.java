package io.github.jedcn.baud;

import org.apache.commons.net.telnet.TelnetClient;
import org.apache.commons.net.telnet.EchoOptionHandler;
import org.apache.commons.net.telnet.SuppressGAOptionHandler;
import org.apache.commons.net.telnet.TerminalTypeOptionHandler;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class TelnetSession implements AutoCloseable {

    private TelnetClient telnetClient;
    private boolean connected;

    public TelnetSession() {
        this.telnetClient = new TelnetClient();
        this.connected = false;
    }

    public void connect(String host, int port, int timeoutSeconds) throws IOException {
        // Configure telnet option handlers
        try {
            // Echo - we want to handle echoing locally
            telnetClient.addOptionHandler(
                new EchoOptionHandler(false, false, true, true)
            );

            // Suppress Go-Ahead
            telnetClient.addOptionHandler(
                new SuppressGAOptionHandler(true, true, true, true)
            );

            // Terminal Type - advertise as VT100
            telnetClient.addOptionHandler(
                new TerminalTypeOptionHandler("VT100", false, false, true, false)
            );

        } catch (Exception e) {
            throw new IOException("Failed to configure telnet options: " + e.getMessage(), e);
        }

        // Set connection timeout
        telnetClient.setConnectTimeout(timeoutSeconds * 1000);

        // Connect to the BBS
        telnetClient.connect(host, port);
        connected = true;

        // Set socket timeout for read operations (0 = infinite)
        telnetClient.setSoTimeout(0);
    }

    public boolean isConnected() {
        return connected && telnetClient.isConnected();
    }

    public InputStream getInputStream() throws IOException {
        if (!isConnected()) {
            throw new IOException("Not connected to telnet server");
        }
        return telnetClient.getInputStream();
    }

    public OutputStream getOutputStream() throws IOException {
        if (!isConnected()) {
            throw new IOException("Not connected to telnet server");
        }
        return telnetClient.getOutputStream();
    }

    public void disconnect() throws IOException {
        if (connected) {
            telnetClient.disconnect();
            connected = false;
        }
    }

    @Override
    public void close() throws Exception {
        disconnect();
    }
}
