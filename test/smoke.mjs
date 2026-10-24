// Smoke test: start the server over stdio and check that tools/list answers.
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["index.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
const pending = new Map();
let buffer = "";

child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function request(id, method, params) {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

const timer = setTimeout(() => {
  console.error("timeout waiting for the server");
  child.kill();
  process.exit(1);
}, 30000);

const init = await request(1, "initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "1.0.0" },
});
if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const list = await request(2, "tools/list", {});
const tools = list.result?.tools ?? [];
const names = tools.map((t) => t.name);
for (const required of ["textokit_catalog", "textokit_sample"]) {
  if (!names.includes(required)) throw new Error(`missing tool ${required}`);
}
if (tools.length < 19) throw new Error(`expected at least 19 tools, got ${tools.length}`);
console.log(`ok: ${tools.length} tools`);

clearTimeout(timer);
child.kill();
