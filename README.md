# Hyperion Explorer

A lightweight blockchain explorer built with **Angular v22** and **server-side rendering (SSR)** via Fastify. Designed to work as a companion to the [Hyperion History API](https://github.com/eosrio/hyperion-history-api).

## Features

- **Server-Side Rendering** — Fastify-based SSR server for fast initial page loads and SEO
- **Account Viewer** — balances, resources, tokens, and action history
- **Block Inspector** — producer, block ID, transactions, and navigation
- **Transaction Details** — actions, authorization, and data payloads
- **Public Key Lookup** — find accounts associated with a public key
- **Contract Tables** — browse smart contract table data
- **Token Top Holders** — chart of top holders for any token
- **Custom Themes** — pluggable `.theme.mjs` files for branding

## Requirements

- **Node.js** 22.22.3+, 24.15.0+, or 26+ (the supported Angular 22 runtime ranges)
- **Bun** 1.4.3 for reproducible installs using the committed lockfile
- **Hyperion History API** ≥ v4.0.0

## Deployment

### 1. Clone & Build

```bash
# Clone inside the hyperion-history-api folder (convention: "explorer")
cd hyperion-history-api
git clone https://github.com/eosrio/hyperion-explorer.git explorer
cd explorer

# Install dependencies and build for production
bun install --frozen-lockfile
bun run build
```

### 2. Start the SSR Server

```bash
# Option A: Start directly with Node.js
npm run serve:ssr:hyperion-explorer

# Option B: Start with PM2 (recommended for production)
pm2 start ecosystem.config.js
```

The SSR server listens on **port 4777** by default (configurable via `HYP_EXPLORER_PORT`).

### 3. Configure Hyperion API

Edit the chain config at `hyperion-history-api/config/chains/<chain>.config.json`:

```jsonc
{
  "api": {
    // ... other api settings
    "explorer": {
      "upstream": "http://127.0.0.1:4777",
      "theme": "default", // optional: matches <name>.theme.mjs
      "home_redirect": true // optional: redirect / to /explorer
    }
  }
}
```

The Hyperion API will proxy all `/explorer/*` requests to the SSR server.

## Environment Variables

| Variable                     | Default          | Description                                                                                                                          |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `HYP_EXPLORER_PORT`          | `4777`           | SSR server listening port                                                                                                            |
| `HYP_EXPLORER_HOST`          | `127.0.0.1`      | SSR server bind address                                                                                                              |
| `HYP_EXPLORER_ALLOWED_HOSTS` | Angular defaults | Comma-separated public hostnames allowed by Angular SSR, without scheme or port (for example `explorer.example.com,api.example.com`) |

Set `HYP_EXPLORER_ALLOWED_HOSTS` to the public hostname(s) received through the API proxy. Angular 22 validates the request host; an unlisted hostname returns HTTP 400. Forwarded host headers are not trusted by the SSR engine. The existing `x-hyperion-server` header from Hyperion still selects the API origin. Keep the SSR listener private behind that trusted proxy.

## Custom Themes

Themes customize the explorer's appearance per deployment (logos, colors, labels).

1. Create a file at `explorer/themes/<name>.theme.mjs`
2. Export a `themeData` object:
   ```js
   themeData = {
     logo: "/assets/my-logo.png",
     title: "My Chain Explorer"
     // ... additional theme properties
   };
   ```
3. Set `"theme": "<name>"` in the chain config

## Development

```bash
# Install dependencies
bun install --frozen-lockfile

# Start dev server with hot reload (port 4210)
bun run start

# Watch mode with production-like SSR
bun run serve:ssr:watch
```

### Build Configurations

| Configuration | Base Href   | API URL         | Use                         |
| ------------- | ----------- | --------------- | --------------------------- |
| `production`  | `/explorer` | Auto-detected   | Production behind API proxy |
| `development` | `/`         | Dev environment | Local development           |

## Routes

| Path                             | Component   | Description                             |
| -------------------------------- | ----------- | --------------------------------------- |
| `/`                              | Home        | Search bar + recent blocks/transactions |
| `/account/:name`                 | Account     | Balances, resources, actions            |
| `/block/:num_or_id`              | Block       | Block details and transactions          |
| `/transaction/:id`               | Transaction | Transaction actions and data            |
| `/key/:pub_key`                  | Key         | Accounts linked to a public key         |
| `/contract/:code/:table/:scope`  | Contract    | Smart contract table browser            |
| `/top-holders/:contract/:symbol` | Top Holders | Token holder distribution chart         |

## Architecture

```
                    ┌─────────────────┐
  Client ──────────>│  Hyperion API   │
                    │  (Fastify)      │
                    │                 │
                    │  /explorer/* ───┼──── proxy ────> Explorer SSR Server
                    │  /v2/*          │                 (Fastify + Angular SSR)
                    │  /v1/*          │                 Port 4777
                    └─────────────────┘
```

## License

[MIT](./LICENSE)

## Validation

```bash
bun run typecheck
bun run test                       # Vitest; no Chrome installation needed
bun run build                     # browser + Fastify SSR production bundles
bunx playwright install chromium   # once per development machine
bun run test:e2e                   # tests the production build, after building
bun audit
```

The browser suite starts a local API fixture on `127.0.0.1:17000` and the built SSR server on `127.0.0.1:17001`. It exercises the actual `/explorer` proxy, hydration, account search, block/transaction rendering, lossless uint64 history cursors and metadata, and recovery from unavailable metadata, account projections, and delta history. Both desktop and mobile configurations use Chromium; mobile emulation does not establish Safari or physical-device compatibility.

Hyperion 4.5 sequence metadata is stored as decimal strings. Safe integer values from older APIs remain supported; unsafe numeric sequences are rejected because their exact identity has already been lost. Upgrade APIs returning those numbers to the lossless string contract.

The [modernization notes](docs/modernization.md) record dependency constraints, completed work, and remaining Hyperion 4.5 qualification. The CI workflow runs type checking, unit tests, and production builds on Windows and Linux with Node 22/24, with the browser suite on Linux/Node 24.
