# Wire testnet preview operations

This is an operational snapshot from 2026-11-04, not a release qualification or a promise of complete history. The public preview is [testnet.wire.eosrio.io](https://testnet.wire.eosrio.io). The API reports package version 4.0.7; it must not be presented as Hyperion 4.5 GA. Full Wire MongoDB replay remains unqualified.

## Observed service and coverage

At 11:35 UTC, public checks covered the root, API, RPC, block and transaction routes, CORS, header handling and denied producer/network endpoints. Desktop and mobile browser checks covered hydration, search, block and transaction views. The independently sampled API health reported 65,164 indexed blocks, 2,630,062 missing blocks (97.58%) and a head offset of 7,049. These are a timestamped observation, not current coverage. State endpoints return 503 when their prerequisites are unavailable. Older traces outside the certified proof coverage may also return 503; do not describe absent history as an empty chain. SHiP's retained stream begins at block 2, and an API count reporting block 1 does not establish complete block-1 ingestion.

Known preview issues at this snapshot include the logo error, missing RAM market data and NET values rendered as NaN. Treat their resolution as separate deployments requiring fresh evidence.

## Deployed topology

- Explorer SSR source `0f831ed18686d43fa17e0565351d31cfee60cfe0`, tree `26730a6` (129 files); release PR #9 merged as `19bf21e7`.
- API source [`3baf7f516687976812d08a469033f92668965db7`](https://github.com/eosrio/hyperion-history-api/tree/engineering/wire-h3-api-3baf-191), tree `529e38e4890c030e53f2cfbaf60ac62d7cf5e6e7`. Its historical-certificate option remains off because the current indexer does not publish those certificates.
- The indexer remains on BCA `bca518ddfebf04c2af957832f2ad9c0582c17932`; its observed master PID was 12523 at cutover. A PID is an observation, not a durable identity: compare process birth and executable before any operation.
- Hyperion-3 guest `h45-wire-explorer-20261104` has 6 CPUs, 12 GiB RAM and 96 GiB disk, Node 26.4, and isolated Elasticsearch 9.5.5, MongoDB 8.0.34, RabbitMQ and Redis services. Edge `eosrio9900` reaches H3 over LAN at `192.168.0.53:17000` (API) and `:14777` (SSR). The persistent `h45-wire-preview-lan-filter` unit permits only edge `192.168.0.41` through `H45_WIRE_PREVIEW`; Tailnet TCP edge access was blocked in this observation.
- The edge vhost `/etc/nginx/sites-enabled/testnet.wire.eosrio.io` was activated with SHA-256 `f17b5d5c28fba033a0168bf65c1f1604013cbbc0914947f0bd3a404b79f974cb`. It preserves chain routing and denies producer and net routes. TLS and ACME remain on the edge.

The initial edge activation receipt failed after reload while the old root was still observed; it is retained as **active, unverified**. Later independent public HTTP and browser checks verified the new preview. Do not relabel the earlier receipt as a pass.

## Checks and rollback

Before any change, record current service identity, unit and configuration hashes, upstream listeners, source and release manifests, indexer birth/executable, queue names and public responses. Compare them with the exact expected successor of this snapshot. A changed hash or unknown process means stop and investigate; do not overwrite newer work. Preserve receipts and backups, including failed attempts. Do not purge queues, delete indexes or volumes, bypass source authority, or restart the indexer as part of a UI or API rollback.

1. **Edge:** Verify the live vhost still hashes to the expected currently deployed candidate and the retained prior vhost `/root/h45-wire-explorer-edge-20261104/vhost.before` to its original SHA-256 `0fe64abf675e7ee8abfe3c8502d0c362d305d6e775f9a1dd5d1049264a177666`. Restore only that exact backup atomically, run `nginx -t`, reload nginx only after validation, and verify chain/RPC routes and producer/net denials. Keep the LAN filter in place. If either hash or the backup provenance differs, stop.
2. **SSR:** Verify `current` points to `releases/0f831ed18686d43fa17e0565351d31cfee60cfe0`, the service unit and both release inventories match their recorded hashes, and the previous release `70a841335e8fdc9774056c1221f581e098a1b0e9` is intact against its retained manifest SHA-256 `2b614c28c778a4671b46ec44829e53d8ae52c693c01f50ce0e7f6bd1cb7dd68c`. Stop only `wire-explorer.service`, atomically switch the symlink to the verified prior release, start the service and check private root and account responses before checking public routing. A Git commit alone does not verify installed bytes.
3. **API:** Verify the active unit, three environment SHA pins, config, connections and installed inventory against the actual cutover receipt, and verify the saved previous unit bytes have SHA-256 `354aa14b732a43354cd5345826ea1c3f6c2790e5e827732e6895d6087521d28a`. Stage the verified backup before stopping only `wire-preview-api.service`; atomically restore it, reload systemd, start the API and verify source identity, health, chain and representative block/transaction responses. The rollback may restore the prior trace serialization defect. Confirm indexer birth/executable and queue names are unchanged; worker replacement alone is not proof of an indexer restart.

For each rollback, retain normal-wait exit, stdout, stderr and resulting hashes. A timeout does not prove the service operation or its descendants stopped; establish closure before retrying. Recheck public root, deep links, API, RPC, CORS and denied routes, and report any unavailable historical coverage explicitly.

Primary operator evidence is retained outside this repository under `P:/eosrio/hyperion-tools/out/root-coordination-20261028-resume/wire-h3-deployment-root-20261104/`, including `public-acceptance/http-acceptance.json`, `activate-wire-explorer-public/`, `cutover-api-3baf/` and `switch-ssr0f/`. Do not publish private configurations or credentials from those records.
