# Changelog

## Unreleased (2026-11-03)
- Fuller tool descriptions for bcra-indicadores, fx-rates, x402-adoption, polymarket-markets and comparar-textos (what each returns, when to use it, when not and which sibling tool to use instead), plus clearer catalog and sample descriptions. The other tools keep their one-line OpenAPI summary.

## 0.1.2 (2026-10-23)
- Lean tool list: shorter descriptions, about 39% fewer bytes in `tools/list` (19 tools: 17 paid routes, the free catalog and the free sample).
- `server.json` 0.1.3 for the official MCP registry points to npm 0.1.2 and to the remote endpoint `https://tienda.textokit.store/mcp`.
- README documents the remote MCP endpoint and links the fixed-price custom MCP server service.

## 0.1.1 (2026-10-20)
- First npm release: stdio MCP server for tienda.textokit.store, paid x402 tools on Base charged to the caller's own wallet, free catalog and samples, `server.json` for the MCP registry.

## Repository (2026-10-21 to 2026-10-24)
- MIT License, CI smoke test on Node 20 and 22 (`npm test` starts the server over stdio and checks the 19 tools), Glama, mcpservers.org and M8ven listing badges.
