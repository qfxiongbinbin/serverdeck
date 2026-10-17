#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";
import { fileURLToPath } from "node:url";

// author: BrianXiong
// time: 2026/10/18/03:20:00
// MCP server (stdio) that proxies to the running ServerDeck app over its local
// Unix socket, so agent runtimes can reuse saved hosts, keys and jump hosts.
// Optional guard rails:
//   SERVERDECK_MCP_ALLOW_HOSTS  comma separated labels/addresses/ids; when set,
//                               exec is refused for anything else
//   SERVERDECK_MCP_AUDIT_LOG    audit log path (default ~/.serverdeck/mcp-audit.log)
//   SERVERDECK_SOCKET           override the app socket path

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.resolve(scriptDir, "..", "package.json"), "utf8"));
const serverVersion = packageJson.version || "0.0.0";

const socketPath =
  process.env.SERVERDECK_SOCKET || path.join(os.homedir(), ".serverdeck", "agent.sock");
const auditLogPath =
  process.env.SERVERDECK_MCP_AUDIT_LOG || path.join(os.homedir(), ".serverdeck", "mcp-audit.log");
const allowHosts = (process.env.SERVERDECK_MCP_ALLOW_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "list_hosts",
    description:
      "List servers saved in ServerDeck (label, address, port, username, project, jump host). Secrets are never returned.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "exec",
    description:
      "Run a non-interactive shell command on a saved server over ssh. Reuses ServerDeck keys, passwords and jump hosts. Returns exit status, stdout and stderr.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Host label, address or id" },
        command: { type: "string", description: "Shell command to run on the remote host" }
      },
      required: ["host", "command"],
      additionalProperties: false
    }
  }
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// author: BrianXiong
// time: 2026/10/18/03:20:00
function audit(entry) {
  try {
    fs.appendFileSync(auditLogPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch {
    // Auditing must never break a tool call.
  }
}

function socketRequest(payload) {
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

async function socketCall(payload) {
  const response = await socketRequest(payload);
  if (!response?.ok) {
    throw new Error(response?.error || "ServerDeck returned an error");
  }
  return response.data;
}

function formatHostList(hosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    return "No hosts saved yet.";
  }

  return hosts
    .map((host) => {
      const jump = host.jumpHostId ? " (via jump host)" : "";
      return `${host.label || host.address}\t${host.username}@${host.address}:${host.port}${jump}`;
    })
    .join("\n");
}

function assertHostAllowed(host) {
  if (allowHosts.length === 0) {
    return;
  }
  if (!allowHosts.includes(host)) {
    throw new Error(
      `Host "${host}" is not allowed for MCP. Allowed hosts: ${allowHosts.join(", ")}`
    );
  }
}

async function callTool(name, args) {
  if (name === "list_hosts") {
    const data = await socketCall({ command: "list_hosts" });
    audit({ tool: name, ok: true });
    return formatHostList(data.hosts);
  }

  if (name === "exec") {
    const host = typeof args?.host === "string" ? args.host.trim() : "";
    const command = typeof args?.command === "string" ? args.command.trim() : "";
    if (!host || !command) {
      throw new Error("exec requires both host and command");
    }

    assertHostAllowed(host);
    const data = await socketCall({ command: "exec", host, remoteCommand: command });
    audit({
      tool: name,
      host,
      command,
      status: data.status ?? null,
      ok: data.status === 0
    });

    const parts = [`status: ${data.status ?? "unknown"}`];
    if (data.stdout) {
      parts.push(`stdout:\n${data.stdout}`);
    }
    if (data.stderr) {
      parts.push(`stderr:\n${data.stderr}`);
    }
    return parts.join("\n");
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleRequest(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "serverdeck", version: serverVersion }
    });
    return;
  }

  if (method === "ping") {
    reply(id, {});
    return;
  }

  if (method === "tools/list") {
    reply(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments ?? {};
    try {
      const text = await callTool(toolName, toolArgs);
      reply(id, { content: [{ type: "text", text }], isError: false });
    } catch (error) {
      audit({ tool: toolName, ok: false, error: error instanceof Error ? error.message : String(error) });
      reply(id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      });
    }
    return;
  }

  replyError(id, -32601, `Method not found: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    replyError(null, -32700, "Parse error");
    return;
  }

  // Notifications (no id) are expected, e.g. notifications/initialized.
  if (message.id === undefined || message.id === null) {
    return;
  }

  void handleRequest(message).catch((error) => {
    replyError(message.id, -32603, error instanceof Error ? error.message : String(error));
  });
});

process.stderr.write("[serverdeck-mcp] ready on stdio\n");
