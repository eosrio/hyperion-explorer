# Local explorer lab

`bun run mock` builds and serves the production frontend at
http://127.0.0.1:17100/explorer/. `bun run mock:serve` reuses `dist/mock`.
The API/Socket.IO server binds to loopback 17100 and proxies `/explorer` to its
owned SSR server on 17101. Override these with `HYP_MOCK_PORT` and
`HYP_MOCK_SSR_PORT`; `HYP_MOCK_DIST` selects a different SSR entry file.
The test runner independently owns 17200/17201.

All data is deterministic and fictional. The sample public key is public development
fixture data; there are no private keys, wallets, signatures, real assets or chain calls.
The mock is development tooling and is never included in the production server.

## Pages

| View                | Route under `/explorer`                                                         | Exercises                                                                        |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Home                | `/` → Show Chain Details                                                        | Resource/market stats, 48 oracle buckets, 21 producers                           |
| Account             | `/account/eosio`                                                                | Balances, staking/refund, 2 tokens, nested permissions, votes, 72 varied actions |
| Other/empty account | `/account/alice`, `/account/empty`                                              | Account navigation and empty history                                             |
| Block               | `/block/100`                                                                    | Transactions, action details and table deltas                                    |
| Transaction         | `/transaction/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` | Exact action metadata and finality                                               |
| Public key          | `/key/EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5SoA82QKS2jD1xrF1vARe`                    | Three linked accounts                                                            |
| Contract            | `/contract/vault.defi/vaults/alice`                                             | ABI, scope selection, 8 rows, string uint64 IDs, all three views                 |
| Token contract      | `/contract/eosio.token/accounts/alice`                                          | Asset balances, stat table                                                       |
| Holders             | `/top-holders/eosio.token/SYS`, `/top-holders/seed.token/SEED`                  | Ten ranked holders, correct symbols and displayed-holder shares                  |

`GET /__fixture/scenarios` lists sample identifiers. History filtering supports
account, contract, action, transfer direction, exact sequence ranges, sorting and paging.
Oracle pair and interval controls change returned data. Dates are frozen to October 21,
2026, to make rendering reproducible.

## Scenario controls

`POST /__fixture/state` **replaces** the scenario, clears live history/request logs,
resets the head/LIB and disconnects existing streams. Reload the browser after changing
chain identity or metadata. An empty object restores the default.

```powershell
$fixture = 'http://127.0.0.1:17100'
Invoke-RestMethod "$fixture/__fixture/state" -Method Post -ContentType application/json -Body '{"theme":"dark"}'
```

| Field                                                                                                                                                                                                                                                                | Values / effect                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `theme`                                                                                                                                                                                                                                                              | `default`, `forest` (Canopy), `dark` (Nightfall); each has its own chain ID/logo/palette |
| `manualStreaming`                                                                                                                                                                                                                                                    | `true` disables the automatic two-second action cadence                                  |
| `streamingPaused`                                                                                                                                                                                                                                                    | Pauses live emission                                                                     |
| `latencyMs`                                                                                                                                                                                                                                                          | Adds API latency, clamped to 0–3000 ms                                                   |
| `emptyAccount`, `emptyHistory`, `emptyTables`, `emptyProducers`, `emptyHolders`                                                                                                                                                                                      | Empty projections                                                                        |
| `disableOracle`                                                                                                                                                                                                                                                      | Hides the Price History tab                                                              |
| `metadataUnavailable`, `chainUnavailable`, `producersUnavailable`, `accountUnavailable`, `actionsUnavailable`, `transactionUnavailable`, `keyUnavailable`, `blockUnavailable`, `contractUnavailable`, `holdersUnavailable`, `oracleUnavailable`, `deltasUnavailable` | Retryable HTTP 503 for the selected projection                                           |
| `sequences`                                                                                                                                                                                                                                                          | Array of canonical uint64 decimal strings for lossless boundary cases                    |
| `initialActions`                                                                                                                                                                                                                                                     | Number of actions returned by account bootstrap, useful for Load more                    |
| `unsafeSequence`                                                                                                                                                                                                                                                     | Sends an unsafe legacy number to exercise rejection/recovery                             |

The footer's Theme control exposes the shipped appearance presets. Opening it leaves
the chain theme intact; selecting Chain default restores the deployment palette. Local
appearance overrides are scoped by chain ID in browser storage.

Use an unknown account such as `/account/zzzz` to exercise the named not-found state.
The history toolbar retains category filters, saved custom filters, UTC/compact display
options and page sizes. Contract scope options support paged discovery, a request limit
and direct scope entry, including scopes outside the currently displayed page.

## Streaming

On an account page, enable Action Live Streaming. New rows queue behind **New actions**;
select that button to apply the queue. Navigating away or switching off cancels the stream.
The queue retains the latest 500 received actions and shows that limit when full.
Connection phase and the last received action time are shown independently of chain finality.
The mock uses the real Socket.IO `/stream` protocol and the published stream client:
handshake, request acknowledgement, historical catch-up/history_end, live messages,
LIB updates, transport drop/reconnect and cancellation.

```powershell
Invoke-RestMethod "$fixture/__fixture/state" -Method Post -ContentType application/json -Body '{"manualStreaming":true}'
# Reload the account, then enable streaming in the browser.
Invoke-RestMethod "$fixture/__fixture/stream" -Method Post -ContentType application/json -Body '{"event":"emit"}'
Invoke-RestMethod "$fixture/__fixture/stream" -Method Post -ContentType application/json -Body '{"event":"disconnect"}'
```

Other stream events: `pause`, `resume`, `lib`, `fork`. `GET /__fixture/state` reports
active subscriptions/head/LIB. `GET /__fixture/requests` shows the last 1000 API requests.
Fork injection exercises event delivery only; this fixture does not simulate consensus,
a reorganizing chain, full ABI execution, SHIP ingestion, or production backpressure.
Real Hyperion 4.5 server/client integration remains a separate release qualification.

## Validation

```powershell
bun run typecheck
bun run test
bun run test:mock
bun run build:mock
$env:HYP_E2E_DIST = 'dist/mock'
bun run test:e2e
```

Browser checks cover desktop and mobile Chromium, SSR/hydration, all route types,
projection outages/recovery, exact uint64 cursors, queued streaming/reconnect/cleanup,
layout overflow and the three chain palettes. This does not establish Safari or
physical-device compatibility.
