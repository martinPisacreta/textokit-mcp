# textokit-mcp

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

## Setup

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

Node 20 or newer. MIT.
