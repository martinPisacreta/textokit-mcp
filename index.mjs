#!/usr/bin/env node
// textokit-mcp: MCP server (stdio) for tienda.textokit.store, the x402 store run by
// Automata (ERC-8004 agent 98748) on Base. Each store route becomes an MCP tool.
// Paid tools are settled with x402 v2 from the BUYER's wallet (TEXTOKIT_PRIVATE_KEY).
// Without a key only the free tools work (catalog and samples). The key is never printed.
//
// Client config example:
//   { "command": "npx", "args": ["-y", "textokit-mcp"],
//     "env": { "TEXTOKIT_PRIVATE_KEY": "0x...", "TEXTOKIT_MAX_CENTS": "1" } }
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_URL = (process.env.TEXTOKIT_BASE_URL || 'https://tienda.textokit.store').replace(/\/$/, '');
const MAX_CENTS = Number(process.env.TEXTOKIT_MAX_CENTS || '1');
const TIMEOUT_MS = Number(process.env.TEXTOKIT_TIMEOUT_MS || '90000');
const BASE_CHAIN_ID = 8453;

const rawKey = process.env.TEXTOKIT_PRIVATE_KEY;
const account = rawKey ? privateKeyToAccount(rawKey.startsWith('0x') ? rawKey : '0x' + rawKey) : null;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const unb64 = (s) => JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
const hex = (bytes) => '0x' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// ---------- x402 v2 client (EIP-3009 transferWithAuthorization on USDC) ----------
async function x402Post(url, body) {
  const first = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (first.status !== 402) {
    return { status: first.status, ok: first.ok, body: await readBody(first) };
  }
  const header = first.headers.get('payment-required');
  if (!header) return { status: 402, ok: false, body: 'HTTP 402 without PAYMENT-REQUIRED header (x402 v2 expected)' };
  const required = unb64(header);
  const a = (required.accepts || []).find((x) => x.network === 'eip155:' + BASE_CHAIN_ID) || required.accepts?.[0];
  if (!a) return { status: 402, ok: false, body: 'No accepted payment option in 402' };
  const cents = Number(a.amount) / 10_000;
  if (cents > MAX_CENTS) {
    return { status: 402, ok: false, body: `Payment of ${cents} cents exceeds TEXTOKIT_MAX_CENTS=${MAX_CENTS}` };
  }
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: a.payTo,
    value: String(a.amount),
    validAfter: String(now - 60),
    validBefore: String(now + Number(a.maxTimeoutSeconds || 300)),
    nonce: hex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const signature = await account.signTypedData({
    domain: { name: a.extra?.name, version: a.extra?.version, chainId: BASE_CHAIN_ID, verifyingContract: a.asset },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) },
  });
  const paymentPayload = { x402Version: 2, resource: required.resource, extensions: required.extensions, accepted: a, payload: { signature, authorization } };
  const paid = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': b64(paymentPayload), 'X-Payment': b64(paymentPayload) },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const receiptHeader = paid.headers.get('payment-response');
  const receipt = receiptHeader ? safe(() => unb64(receiptHeader)) : null;
  return { status: paid.status, ok: paid.ok, body: await readBody(paid), paid: { amountUsdc: Number(a.amount) / 1e6, transaction: receipt?.transaction, settled: receipt?.success } };
}
const safe = (f) => { try { return f(); } catch { return null; } };
async function readBody(r) { const t = await r.text(); return safe(() => JSON.parse(t)) ?? t; }

// ---------- tools from the store's OpenAPI ----------
async function loadSpec() {
  const r = await fetch(BASE_URL + '/openapi.json', { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('Could not load ' + BASE_URL + '/openapi.json (HTTP ' + r.status + ')');
  return r.json();
}
function stripX(s) {
  if (Array.isArray(s)) return s.map(stripX);
  if (s && typeof s === 'object') { const o = {}; for (const [k, v] of Object.entries(s)) if (!k.startsWith('x-')) o[k] = stripX(v); return o; }
  return s;
}
// Lean tool list (0.1.2, same as the remote server 0.2.1): a client measured ~5.6k tokens per request on the full one.
const cap = (t, n) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n) > 40 ? t.lastIndexOf(' ', n) : n) + '…');
function slim(s) {
  if (Array.isArray(s)) return s.map(slim);
  if (s && typeof s === 'object') { const o = {}; for (const [k, v] of Object.entries(s)) if (!['examples', 'example', '$schema', 'title', '$comment'].includes(k)) o[k] = k === 'description' && typeof v === 'string' ? cap(v, 60) : slim(v); return o; }
  return s;
}
function leanSchema(schema) {
  const s = slim(stripX(schema || { type: 'object', properties: {} }));
  for (const k of ['allOf', 'anyOf', 'oneOf', 'if', 'then', 'else', 'not']) delete s[k]; // cross-field rules stay server-side (the store answers 400)
  return s;
}
function buildTools(spec) {
  const paid = [];
  for (const [p, item] of Object.entries(spec.paths || {})) {
    const op = item.post;
    if (!op || p.endsWith('/sample')) continue;
    const route = p.replace(/^\/api\//, '');
    const pay = op['x-payment-info'] || {};
    const price = pay.price?.amount ? `${pay.price.amount} USDC` : 'see 402';
    paid.push({
      name: 'textokit_' + route.replace(/-/g, '_'),
      route,
      price: pay.price?.amount,
      network: pay.network,
      summary: op.summary,
      description: `${op.summary || route}. ${price} per call, paid with x402 on Base from your wallet. Free sample: textokit_sample.`,
      inputSchema: leanSchema(op.requestBody?.content?.['application/json']?.schema),
    });
  }
  const free = [
    { name: 'textokit_catalog', description: 'List all store routes with price in USDC, network and summary. Free, no payment.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'textokit_sample', description: 'Free sample of one route: same schema as the paid output plus an inputExample. Use it before paying.', inputSchema: { type: 'object', required: ['route'], properties: { route: { type: 'string', enum: paid.map((t) => t.route), description: 'Route name, e.g. web-read' } }, additionalProperties: false } },
  ];
  return { paid, free };
}

const spec = await loadSpec();
const { paid, free } = buildTools(spec);
const server = new Server({ name: 'textokit-mcp', version: '0.1.2' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...free, ...paid].map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const text = (s) => ({ content: [{ type: 'text', text: typeof s === 'string' ? s : JSON.stringify(s, null, 2) }] });
  const fail = (s) => ({ ...text(s), isError: true });
  try {
    if (name === 'textokit_catalog') return text(paid.map(({ route, name: tool, price, network, summary }) => ({ route, tool, price_usdc: price, network, summary })));
    if (name === 'textokit_sample') {
      const r = await fetch(`${BASE_URL}/api/${args.route}/sample`, { signal: AbortSignal.timeout(30000) });
      return r.ok ? text(await r.json()) : fail(`sample ${args.route}: HTTP ${r.status}`);
    }
    const tool = paid.find((t) => t.name === name);
    if (!tool) return fail(`Unknown tool: ${name}`);
    if (!account) return fail('This tool is paid (x402). Set TEXTOKIT_PRIVATE_KEY to an EVM private key holding USDC on Base, or call textokit_sample for the free sample.');
    const res = await x402Post(`${BASE_URL}/api/${tool.route}`, args);
    if (!res.ok) return fail({ status: res.status, error: res.body, paid: res.paid });
    return text(res.paid ? { result: res.body, payment: res.paid } : res.body);
  } catch (err) {
    return fail(err?.message || String(err));
  }
});

await server.connect(new StdioServerTransport());
console.error(`textokit-mcp ready: ${paid.length} paid tools + ${free.length} free; wallet ${account ? account.address : 'none (free tools only)'}; cap ${MAX_CENTS} cents per call`);
