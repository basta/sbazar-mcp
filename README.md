# sbazar

[![npm](https://img.shields.io/npm/v/sbazar.svg)](https://www.npmjs.com/package/sbazar)
[![license](https://img.shields.io/npm/l/sbazar.svg)](./LICENSE)

An [MCP](https://modelcontextprotocol.io) server for [Sbazar.cz](https://www.sbazar.cz), the Czech classifieds marketplace. Lets Claude (or any MCP client) search Sbazar listings and fetch full item details.

## Tools

- **`sbazar_search`** — Search listings by phrase, with optional price range and locality filter.
- **`sbazar_get_item`** — Fetch full details (description, images, seller, etc.) of a listing by ID or URL.

## Install

Requires Node.js 18+.

The server is published to npm and runs via `npx` — no clone or build needed.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sbazar": {
      "command": "npx",
      "args": ["-y", "sbazar"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add sbazar -- npx -y sbazar
```

Or add to `.mcp.json` in your project / `~/.claude.json`:

```json
{
  "mcpServers": {
    "sbazar": {
      "command": "npx",
      "args": ["-y", "sbazar"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (or per-project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "sbazar": {
      "command": "npx",
      "args": ["-y", "sbazar"]
    }
  }
}
```

### Other MCP clients

Any client that supports stdio MCP servers can launch it as `npx -y sbazar`.

## Usage examples

Once connected, you can ask the assistant things like:

- *"Find Steam Decks on Sbazar under 8000 Kč in Prague."*
- *"Get the details of `https://www.sbazar.cz/inzerat/123456789-...`."*
- *"Search Sbazar for iPhone 14, max 15000 Kč."*

## Tool reference

### `sbazar_search`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `phrase` | string | yes | Search query (e.g. `"steam deck"`). |
| `limit` | number | no | Max results, 1–60. Default 20. |
| `price_from` | number | no | Minimum price in CZK. |
| `price_to` | number | no | Maximum price in CZK. |
| `locality` | string | no | Filter by city/region (e.g. `"Praha"`). Applied client-side. |

### `sbazar_get_item`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id_or_url` | string | yes | Numeric item ID or full Sbazar.cz listing URL. |

## Develop

```bash
git clone https://github.com/basta/sbazar
cd sbazar
npm install
npm run build
npm start
```

For an inner-loop dev experience (TS run directly via `tsx`):

```bash
npm run dev
```

## License

MIT — see [LICENSE](./LICENSE).

## Disclaimer

This is an unofficial, community-built project. It is not affiliated with or endorsed by Sbazar.cz or Seznam.cz.
