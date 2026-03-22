# Hyperion Explorer

A lightweight blockchain explorer built with **Angular v21** and **server-side rendering (SSR)** via Fastify. Designed to work as a companion to the [Hyperion History API](https://github.com/eosrio/hyperion-history-api).

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

- **Node.js** ≥ 22
- **npm** ≥ 10
- **Hyperion History API** ≥ v4.0.0

## Deployment

### 1. Clone & Build

```bash
# Clone inside the hyperion-history-api folder (convention: "explorer")
cd hyperion-history-api
git clone https://github.com/eosrio/hyperion-explorer.git explorer
cd explorer

# Install dependencies and build for production
npm install
npm run build
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
      "theme": "default",        // optional: matches <name>.theme.mjs
      "home_redirect": true       // optional: redirect / to /explorer
    }
  }
}
```

The Hyperion API will proxy all `/explorer/*` requests to the SSR server.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HYP_EXPLORER_PORT` | `4777` | SSR server listening port |
| `HYP_EXPLORER_HOST` | `127.0.0.1` | SSR server bind address |

## Custom Themes

Themes customize the explorer's appearance per deployment (logos, colors, labels).

1. Create a file at `explorer/themes/<name>.theme.mjs`
2. Export a `themeData` object:
   ```js
   themeData = {
     logo: '/assets/my-logo.png',
     title: 'My Chain Explorer',
     // ... additional theme properties
   };
   ```
3. Set `"theme": "<name>"` in the chain config

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload (port 4200)
npm run start

# Watch mode with production-like SSR
npm run serve:ssr:watch
```

### Build Configurations

| Configuration | Base Href | API URL | Use |
|---|---|---|---|
| `production` | `/explorer` | Auto-detected | Production behind API proxy |
| `development` | `/` | Dev environment | Local development |

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | Home | Search bar + recent blocks/transactions |
| `/account/:name` | Account | Balances, resources, actions |
| `/block/:num_or_id` | Block | Block details and transactions |
| `/transaction/:id` | Transaction | Transaction actions and data |
| `/key/:pub_key` | Key | Accounts linked to a public key |
| `/contract/:code/:table/:scope` | Contract | Smart contract table browser |
| `/top-holders/:contract/:symbol` | Top Holders | Token holder distribution chart |

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
