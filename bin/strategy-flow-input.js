#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {spawn} = require("node:child_process");

const args = process.argv.slice(2);
const options = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 4173),
  open: false,
};

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--help" || argument === "-h") {
    console.log(`Usage: strategy-flow-input [options]

Options:
  --host <host>   Listen host (default: 127.0.0.1)
  --port <port>   Listen port (default: 4173)
  --open          Open the designer in the default browser
  --help          Show this help

Environment:
  HOST            Default listen host
  PORT            Default listen port
`);
    process.exit(0);
  } else if (argument === "--host") {
    options.host = args[++index];
  } else if (argument === "--port") {
    options.port = Number(args[++index]);
  } else if (argument === "--open") {
    options.open = true;
  } else {
    console.error(`Unknown option: ${argument}`);
    console.error("Use --help for usage.");
    process.exit(2);
  }
}

if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
  console.error("Port must be an integer between 1 and 65535.");
  process.exit(2);
}

const root = path.resolve(__dirname, "..");
const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
]);

function sendError(response, status, message) {
  response.writeHead(status, {"Content-Type": "text/plain; charset=utf-8"});
  response.end(message);
}

function requestHandler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return sendError(response, 405, "Method Not Allowed");
  }
  const requestUrl = new URL(request.url, "http://localhost");
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(root, `.${pathname}`);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    return sendError(response, 403, "Forbidden");
  }
  fs.stat(resolvedFile, (error, stats) => {
    if (error || !stats.isFile()) return sendError(response, 404, "Not Found");
    response.writeHead(200, {
      "Content-Type": types.get(path.extname(resolvedFile).toLowerCase()) || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(resolvedFile).pipe(response);
  });
}

const server = http.createServer(requestHandler);
server.on("error", error => {
  console.error(`Failed to start strategy-flow-input: ${error.message}`);
  process.exit(1);
});
server.listen(options.port, options.host, () => {
  const url = `http://${options.host === "0.0.0.0" ? "127.0.0.1" : options.host}:${options.port}`;
  console.log(`strategy-flow-input 1.6.0 · strategy-flow-input/0.5`);
  console.log(`Designer: ${url}`);
  console.log(`Press Ctrl+C to stop.`);
  if (!options.open) return;
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const openArgs = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, openArgs, {detached: true, stdio: "ignore"});
  child.on("error", launchError => {
    console.error(`Could not open browser automatically: ${launchError.message}`);
    console.error(`Open ${url} manually.`);
  });
  child.unref();
});
