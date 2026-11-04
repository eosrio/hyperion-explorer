# Wire root preview handoff

This is a deployment preparation for [issue 4](https://github.com/eosrio/hyperion-explorer/issues/4), not an activation or release qualification. The root build is opt-in; the existing `/explorer` build and server defaults remain available.

## Artifact and runtime

The locally built candidate is source commit `08d39f14e57777b4cb0704af1710832d88ab16d6`, tree `519340542657c653a44346efca0c856170502eed`, based on upstream `9eb97b1772001023c262d5e90e9fb5adf2e13096`. Use Bun 1.4.4 with the committed `bun.lock` and `bunfig.toml`, run `bun install --frozen-lockfile`, `bun run typecheck`, and `bun run build:root-preview`. The candidate lockfile SHA-256 is `c5db3c47dc398a0bb8702ce37705c2bed2cf87f5f5b662b0d32b17cc488b0232`. The explicit `glob` 14.0.2 override resolves `minimatch` 11.0.4 and addresses GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249. It crosses the `@fastify/static` declared `glob` 13 range, so its actual static-serving and full CI compatibility must be checked; remove the override when the dependency declares a compatible fixed version. Local Bun audit reported no vulnerabilities in 503 packages but skipped six Font Awesome packages because the configured registry did not provide an audit response.

The prepared ZIP `explorer-root-package-08d39f1.zip` is 2,238,785 bytes, SHA-256 `ba81266c4740e51b707b86c9f4e4c2b02e2bd3c3d7ad07efa09272b10068010d`. Its separate JSON manifest records all 129 paths, sizes and hashes; manifest SHA-256 is `ecff3d1577168701e88f15e8104404529755df8d7b89944ba123e71e689c8054`. These hashes identify the prepared Windows-built artifact; independently produced builds need their own manifests and qualification.

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
