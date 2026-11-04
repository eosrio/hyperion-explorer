# Wire root preview handoff

This is a deployment preparation for [issue 4](https://github.com/eosrio/hyperion-explorer/issues/4), not an activation or release qualification. The root build is opt-in; the existing `/explorer` build and server defaults remain available.

## Artifact and runtime

The locally built candidate is source commit `beda76b432cda8e2999fcdd6e8fd0ce967674d48`, tree `c1eab5ca6db2dc10f776b919afa8d91d7fd2d952`, based on upstream `9eb97b1772001023c262d5e90e9fb5adf2e13096`. Use Bun 1.4.4 with the committed `bun.lock` and `bunfig.toml`, run `bun install --frozen-lockfile`, `bun run typecheck`, and `bun run build:root-preview`. No dependency versions were changed. The candidate lockfile SHA-256 is `a5fdb7db6efae7c52d515ad7b1b08241558e75d9cbbd33e668d20d28183f67fa`.

The prepared ZIP `explorer-root-package-beda76b.zip` is 2,234,115 bytes, SHA-256 `45acc8acb1b6a355558c34037dd7450ebd80f71f8884b23136256215d3c559b8`. Its separate JSON manifest records all 129 paths, sizes and hashes; manifest SHA-256 is `29d629afba07221330a7dfd8c7c5ff1f8e83e1154fc1fb0c6d8fef12f94d10a7`. These hashes identify the prepared Windows-built artifact; independently produced builds need their own manifests and qualification.

The archive contains `dist/hyperion-explorer/{server,browser}` and `themes/`. Both directories and the package-root working directory matter: the SSR initializer reads `./themes`, and the theme handler resolves themes relative to the server bundle. A dist-only package returned HTTP 500 because `themes/` was absent. With the included themes and a fictional local metadata service, the package served the root, a JavaScript asset, and an account deep link under Node 24.19.0 and 26.4.0 without a `node_modules` directory. This is a focused observation, not a guarantee that every runtime path has no further dependencies.

From the package root, use a supported Node 24 or 26 runtime to start `node dist/hyperion-explorer/server/server.mjs` with:

```text
HYP_EXPLORER_ROOT=true
HYP_EXPLORER_HOST=127.0.0.1
HYP_EXPLORER_PORT=4777
HYP_EXPLORER_ALLOWED_HOSTS=testnet.wire.eosrio.io
```

Keep the listener private. For every proxied SSR request, overwrite `x-hyperion-server` with the literal `https://testnet.wire.eosrio.io`; never forward a client-supplied value. The existing SSR origin selection falls back to the request's `Referer` if this header is absent, so the header must be set on root and deep-link requests alike. The root build and root runtime setting must be deployed together. Do not expose the theme or SSR listener directly to the public. Verify the exact header and actual public routes before activation; this document does not assert that the proxy is configured.

## Route contract

Preserve API, documentation and Socket.IO paths before the root page fallback. The precise upstreams and existing proxy routes must be inventoried on the host before any routing change. The following are calls made by this source, not claims that an endpoint is available on Wire:

| Feature | Method and path | Need |
| --- | --- | --- |
| Chain identity and explorer initialization | `GET /v2/explorer_metadata`, `GET /v2/explorer_logo` | Metadata requires nonempty `chain_id` and `chain_name`; logo is display content. Confirm the expected Wire chain ID. |
| Current head and chain panels | `GET /v1/chain/get_info`; `POST /v1/chain/get_table_rows`, `/v1/chain/get_producers` | Live chain information; table and producer panels depend on supported Wire RPC responses. |
| Block details | `POST /v1/trace_api/get_block` | Body uses `block_num` or `block_id`; requires the trace API, not merely chain get-info. |
| Transaction | `GET /v2/history/get_transaction?id=...` | HAPI indexed history and decoded action data. |
| Account and action history | `GET /v2/state/get_account?account=...`, `GET /v2/history/get_actions?...` | Account projection and history; sequence values must preserve exact decimal identity. |
| Account/key search and creator | `POST /v1/chain/get_table_by_scope`; `GET /v2/state/get_voter_scopes`, `/v2/state/get_key_accounts`, `/v2/history/get_creator` | Needed for the corresponding search/detail features. |
| Contract and state history | `POST /v1/chain/get_abi`, `/v1/chain/get_table_by_scope`, `/v1/chain/get_table_rows`; `GET /v2/history/get_deltas` | Contract browsing and delta history. |
| Token holders and optional price charts | `GET /v2/state/get_top_holders`, `/v2/oracle/pairs`, `/v2/oracle/get_datapoints_histogram` | Feature-specific; availability is separate from the core preview. |
| Account live actions | Socket.IO path `/stream` at the stream client's configured endpoint, defaulting to the API origin | Preserve WebSocket upgrade and polling as applicable; verify history/live handoff, LIB, reconnect and cancellation against the real deployment. |

AtomicAssets is not called by these routes and is not a prerequisite for this scoped preview. Missing optional features must be surfaced as unavailable rather than represented as production data.

## Acceptance before routing

Pin the actual HAPI 4.5 build, Wire configuration and chain identity alongside the exact Explorer package. Verify the private SSR listener and package hashes; then validate through the intended trusted proxy: root HTML and root assets, refreshed account/block/transaction deep links, API/docs/stream precedence, allowed-host behavior, real Wire metadata and representative account, transaction, block and contract responses. Check unavailable and retryable responses and exact large sequence strings. Exercise streaming only if offered, and record its actual outcome.

Record public TLS/cache/routing configuration, served build identity, and a tested rollback plan before activation. Local fixture smoke tests do not establish real Wire data, browser hydration, backend readiness, stream correctness, or release qualification.
