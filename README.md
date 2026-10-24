# textokit-mcp

[![textokit-mcp MCP server](https://glama.ai/mcp/servers/martinPisacreta/textokit-mcp/badges/score.svg)](https://glama.ai/mcp/servers/martinPisacreta/textokit-mcp) [![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/martinpisacreta/textokit-mcp) [![M8ven Trust Index](https://m8ven.ai/badge/mcp/martinpisacreta/textokit-mcp)](https://m8ven.ai/mcp/martinpisacreta/textokit-mcp)

MCP server for [tienda.textokit.store](https://tienda.textokit.store): 17 pay-per-call tools
settled with [x402](https://x402.org) in USDC on Base, plus a free catalog and free samples.
Run by Automata, ERC-8004 agent 98748. Every settlement is public at
https://tienda.textokit.store/receipts.json.

## Tools

Free, no wallet needed:

- `textokit_catalog`: routes, prices, network.
- `textokit_sample`: the free sample of any route (same schema as the paid output) and an input example.

Paid (0.001 to 0.005 USDC per call, charged to your own wallet):

- `textokit_web_read`, `textokit_url_text`: public page to clean text or Markdown.
- `textokit_source_bounded_summary`: summary with quotes verified as substrings.
- `textokit_translate_es`, `textokit_cartas_ar`: Rioplatense Spanish text.
- `textokit_fx_rates`, `textokit_crypto_prices`, `textokit_polymarket_markets`: market data.
- `textokit_dolar_ar`, `textokit_bcra_indicadores`, `textokit_cuit_ar`, `textokit_direcciones_ar`, `textokit_normativa_ar`: Argentine data.
- `textokit_dev_utils`, `textokit_comparar_textos`, `textokit_x402_adoption`, `textokit_x402_ping`.

## Remote server (no install)

The same tools are served over MCP Streamable HTTP at **https://tienda.textokit.store/mcp**
(stateless JSON-RPC over POST; listed in the official MCP Registry as `io.github.martinPisacreta/textokit-mcp`).

Claude Code:

```bash
claude mcp add --transport http textokit https://tienda.textokit.store/mcp
```

Cursor, Windsurf and other clients that accept a URL:

```json
{ "mcpServers": { "textokit": { "url": "https://tienda.textokit.store/mcp" } } }
```

The remote server never receives a private key. Free tools (`textokit_catalog`, `textokit_sample`,
`textokit_how_to_pay`) work right away. A paid tool called without payment returns the x402 payment
requirements; sign them with your own wallet and call the tool again with `payment_signature` (the base64
x402 v2 payload). If you prefer the server to sign for you, use the local package below.

## Setup (local package)

Add to your MCP client (Claude Desktop, Claude Code, Cursor, Windsurf, ...):

```json
{
  "mcpServers": {
    "textokit": {
      "command": "npx",
      "args": ["-y", "textokit-mcp"],
      "env": {
        "TEXTOKIT_PRIVATE_KEY": "0x<EVM private key with USDC on Base>",
        "TEXTOKIT_MAX_CENTS": "1"
      }
    }
  }
}
```

- `TEXTOKIT_PRIVATE_KEY`: optional. Without it only the free tools work; paid tools return an
  explanatory error. Use a dedicated low-balance wallet. The key is never logged.
- `TEXTOKIT_MAX_CENTS`: cap per call in US cents (default 1). Calls above it are refused before signing.
- `TEXTOKIT_BASE_URL`, `TEXTOKIT_TIMEOUT_MS`: optional overrides.

## How payment works

1. The tool POSTs to the route and gets HTTP 402 with x402 v2 payment requirements.
2. The server signs an EIP-3009 `transferWithAuthorization` for the exact amount with your key.
3. It retries with the `PAYMENT-SIGNATURE` header. The store settles through the Coinbase CDP
   facilitator only after a successful response; a failed handler is never charged.
4. The result includes the transaction hash under `payment`.

## Need an MCP server for your own API?

The author builds custom MCP servers like this one for other products: tools mapped to your API,
credentials kept out of the config file, human approval for actions that spend or publish, local
(stdio) or remote (Streamable HTTP), optionally published to npm and the MCP registry.
Fixed-price packages on Upwork: https://www.upwork.com/services/product/2113736906027325062

Node 20 or newer. MIT.
