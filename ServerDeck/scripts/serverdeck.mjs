#!/usr/bin/env node
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// author: BrianXiong
// time: 2026/10/18/03:00:00
// Talks to the running ServerDeck desktop app over its local Unix socket so the
// CLI and external agents reuse the same hosts, keys and jump host config.
const socketPath =
  process.env.SERVERDECK_SOCKET || path.join(os.homedir(), ".serverdeck", "agent.sock");

const args = process.argv.slice(2);

function printUsage() {
  process.stderr.write(
    [
      "ServerDeck CLI (requires the desktop app to be running)",
      "",
      "Usage:",
      "  serverdeck ping                 Check the app is reachable",
      "  serverdeck list                 List saved hosts",
      "  serverdeck exec <host> -- <cmd> Run a command over ssh on a host",
      "",
      "  <host> can be a host label, address or id.",
      "  Env: SERVERDECK_SOCKET overrides the socket path.",
      ""
    ].join("\n")
  );
  process.exit(2);
}

function request(payload) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${JSON.stringify(payload)}\n`));
    socket.on("data", (chunk) => {
      buffer += chunk;
    });
    socket.on("end", () => {
      try {
        resolve(JSON.parse(buffer.trim()));
      } catch {
        reject(new Error(`Invalid response from ServerDeck: ${buffer.trim()}`));
      }
    });
    socket.on("error", (error) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        reject(new Error(`ServerDeck is not running (socket: ${socketPath})`));
        return;
      }
      reject(error);
    });
  });
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function call(payload) {
  const response = await request(payload);
  if (!response?.ok) {
    fail(response?.error || "ServerDeck returned an error");
  }
  return response.data;
}

async function main() {
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
  }

  if (command === "ping") {
    const data = await call({ command: "ping" });
    process.stdout.write(`serverdeck ${data.version} (socket: ${socketPath})\n`);
    return;
  }

  if (command === "list") {
    const data = await call({ command: "list_hosts" });
    const hosts = data.hosts ?? [];
    if (hosts.length === 0) {
      process.stdout.write("No hosts saved yet.\n");
      return;
    }
    for (const host of hosts) {
      const jump = host.jumpHostId ? " (via jump)" : "";
      process.stdout.write(
        `${host.label || host.address}\t${host.username}@${host.address}:${host.port}${jump}\n`
      );
    }
    return;
  }

  if (command === "exec") {
    const separator = rest.indexOf("--");
    const host = (separator === -1 ? rest.slice(0, 1) : rest.slice(0, separator)).join(" ").trim();
    const remoteCommand = (separator === -1 ? rest.slice(1) : rest.slice(separator + 1)).join(" ");
    if (!host || !remoteCommand.trim()) {
      printUsage();
    }

    const data = await call({ command: "exec", host, remoteCommand });
    if (data.stdout) {
      process.stdout.write(data.stdout);
    }
    if (data.stderr) {
      process.stderr.write(data.stderr);
    }
    process.exit(typeof data.status === "number" ? data.status : 0);
  }

  printUsage();
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
