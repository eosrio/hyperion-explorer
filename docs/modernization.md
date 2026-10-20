# Explorer modernization and Hyperion 4.5

This branch starts the modernization effort. It preserves the existing explorer routes, deployment themes, and Hyperion v1/v2 request contracts. Fixture acceptance is separate from qualification against a running Hyperion 4.5 release.

## Dependencies and runtime

- Angular, CLI, Material, CDK, and SSR: 22.2.3, using the official Angular 21 to 22 migrations. The generated explicit `ChangeDetectionStrategy.Eager` settings preserve existing component behavior after Angular's default changed; individual OnPush conversions remain separate work.
- TypeScript: 6.0.x. Angular 22.2 requires `>=6.0 <6.1`; TypeScript 7 is deliberately excluded.
- Node: `^22.22.3 || ^24.15.0 || >=26.0.0`.
- Fastify 5 and its compression/static plugins, Tailwind 4, Font Awesome, ECharts/ngx-echarts, and Motion are upgraded to their current compatible releases.
- The stream client remains at 4.0.0-rc.3, the latest published package at the time of this update. Its version is independent of the Hyperion core release.
- Bun 1.4.3 and a hoisted install layout make lockfile installs reproducible, including Angular peer dependency resolution on Windows. The transitive source-map codec is updated together with Babel to avoid a compiler initialization failure.
- Vitest replaces Karma/Jasmine. Shared test providers and required input fixtures repair the existing smoke tests; additional regressions cover metadata, API errors, endpoint selection, and retry recovery.

## Frontend changes

- The top-holders route loads on demand, removing its chart implementation from the initial bundle. The observed initial production bundle dropped from 1.57 MB to approximately 453 kB during the upgrade.
- Native CSS and Angular `animate.enter` replace the legacy Angular animation package.
- Search, navigation, theme selection, permission expansion, and transaction expansion have accessible names or native keyboard controls. Mobile zoom is enabled, and placeholder animation respects reduced motion.
- Default text colors have stronger contrast; deployment-specific themes remain configurable. Focus styling, narrow-screen permission summaries, SVG sizing, and responsive grid sizing are improved.

## Hyperion compatibility

| Area         | Behavior covered by this branch                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bootstrap    | Valid chain identity initializes the explorer even when history progress is absent or at genesis. Failed metadata requests have a timeout, an error screen, and recovery.                                                                                                      |
| API origin   | Production streaming and oracle requests use the selected deployment rather than `dev.env.ts`. Explicit development stream overrides remain supported.                                                                                                                         |
| Availability | Account, transaction, key, and block views distinguish unavailable requests from empty results and offer retry. Failed delta history leaves the block view usable. Resource values are guarded before reading an errored resource.                                             |
| SSR proxy    | The built Fastify server is exercised behind `/explorer`, including hydration and client navigation. Configure `HYP_EXPLORER_ALLOWED_HOSTS` for the public hostname; forwarded host headers remain untrusted. The standalone default port is aligned with the documented 4777. |
| Themes       | Corrupt or inaccessible browser overrides leave the deployment theme usable. Only CSS custom properties are applied from theme overrides.                                                                                                                                      |

The local 4.5 architecture keeps Elasticsearch history independent of state projection readiness and requires affected queries to report retryable unavailability. These tests exercise HTTP 503 behavior without inventing a release-specific error payload or completeness-header names.

## Remaining qualification

Local acceptance on 2026-10-20 (Windows, Node 26.4.0): production build and type checking passed; 49 unit tests across 35 files passed on Vitest 5.0.5; all 12 desktop/mobile Chromium scenarios passed; `bun audit` reported no advisories. The initial browser bundle is 452.59 kB (estimated transfer 121.84 kB). The only newer direct dependency excluded is TypeScript 7, because it is outside Angular 22's supported range.

1. Run the explorer against pinned 4.5 API, SDK, backend adapter, and plugin artifacts on a real chain. The current fixture tests do not qualify live streaming, finality/fork recovery, or MongoDB/WormDB behavior.
2. Add completeness and last-valid-state presentation when the shared response-header contract is finalized; do not infer state readiness from history progress.
3. Expand recorded real-chain fixtures for contracts, permissions, keys, top holders, oracle data, filtered history, and optional plugins.
4. Continue frontend work on deprecated Material tree APIs, incremental OnPush conversion, component lifecycles, loading/empty states, and consistency across custom themes. EVM components remain placeholders and are not newly qualified by this work.
5. Validate Safari, Firefox, physical mobile devices, production compression/cache behavior, and the actual public proxy configuration.

CI is configured for Windows and Linux but has not run until this branch is pushed. Local validation uses Windows and Node 26. The account component retains a small existing stylesheet budget warning (10.24 kB against a 10 kB warning threshold); the error threshold is unchanged.
