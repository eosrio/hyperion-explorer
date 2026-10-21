# Explorer critique findings closure

October 21, 2026. Scope: the all-page Impeccable critique in
[interface-review.md](interface-review.md), including both independent assessments and
their browser evidence. The original 22/40 score is a baseline, not a new certification.

All corroborated defects below are fixed. Detector notices that do not describe a
rendered defect are classified separately. This ledger does not claim that every possible
usability or accessibility issue has been eliminated.

| Finding                                                       | Implemented resolution                                                                                                       | Evidence                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Duplicate logo and unstable header geometry                   | One configured chain image with fallback; bounded scroll progress, one animation-frame write and common content offset       | `main-search.component.*`; E2E single-logo and reduced-motion route checks |
| Too much fixed mobile chrome; hidden account content          | Detail routes begin compact; mobile account summary recedes; balances/resources stay first and content renders immediately   | Desktop/mobile browser inspection; account layout source                   |
| Home tabs covered by the large header                         | Content offset follows the home header geometry; details remain below it                                                     | Mobile Chain Stats confirmation screenshot; home route checks              |
| Heavy shadows compete with data                               | Shared elevation tokens use lighter shadows; obsolete account effects/styles removed                                         | Shared CSS and desktop/mobile confirmation                                 |
| Click-only live toggle and unnamed refresh                    | Native named switch, checked/busy state, named reload controls                                                               | Keyboard streaming and reconnect E2E                                       |
| Non-keyboard action detail/compact-data controls              | Named native buttons with disclosure state; real navigation anchors                                                          | History controls E2E and action-details source                             |
| Nested expansion-header buttons and unnamed chevrons          | Decorative chevrons belong to the parent expansion control; permission toggles have names                                    | E2E asserts no nested header buttons; permission component                 |
| Unlabeled UTC/compact/save controls                           | Associated native labels; display options grouped together                                                                   | History and saved-filter E2E                                               |
| Click-only contract rows and ambiguous view/reload controls   | Named native row buttons, pressed view states and labeled reload actions                                                     | Contract row Enter-key and view-mode E2E                                   |
| Collapsed Chain Details keyboard reachable                    | Collapsed content is inert and hidden from accessibility; expansion uses a native button                                     | Home E2E inert assertion and browser inspection                            |
| Contract/holders missing explorer shell and contract identity | Shared header/search/provider/footer, visible contract heading and navigation links                                          | All-route E2E and manual contract/holders inspection                       |
| Hardcoded slate/neutral/chart colors bypass chain themes      | Shared tokens applied to tables, dialogs, controls and chart options; inverse glyphs follow panel color                      | Forest/Nightfall seven-route E2E; manual dark contract confirmation        |
| Selected scope unreadable at 1:1                              | Labeled native scope field uses panel foreground/background                                                                  | Contrast regression for every shipped preset                               |
| Additional bright-palette selected-button contrast            | Jungle/QRY/WAX retain brand primaries with dark button text and a compatible gradient                                        | Selected table and scope contrast >=4.5:1 in all nine presets              |
| Scope controls wrap awkwardly and overload the page           | One selector, paging controls and progressive scope options; direct entry remains available                                  | Mobile/desktop scope paging, direct-entry and empty-row E2E                |
| Scope limit/paging and stale row requests                     | Limit clamped to 1–1000, scope history supports back/next, requests track code/table/scope/limit                             | Scope regression and exact-integer sort checks                             |
| Producers exceed wrapper and collide with footer              | Natural document height replaces fixed 800px cap                                                                             | E2E measures footer below the final producer row at both sizes             |
| Holder balances labeled SYS for other tokens                  | Requested token symbol drives heading/table/tooltip; sensible numeric precision                                              | SEED holder E2E and browser inspection                                     |
| Unclear holder share denominator / Others                     | Copy explicitly says displayed-holder balances; ranked table is the exact reference                                          | Holder E2E and source                                                      |
| Holder labels clip on mobile; missing semantics               | Label-free donut plus ranked semantic table, heading and accessible chart name                                               | 390px inspection, named chart/table and overflow checks                    |
| History controls overwhelm the data                           | One grouped category selector; custom filters and display preferences disclosed; pagination follows rows                     | History toolbar and saved-filter E2E; mobile screenshot                    |
| History starts with transaction bookkeeping                   | Action/data precede block/time and transaction details; compact raw data is explicitly expandable                            | History source and keyboard expansion E2E                                  |
| Live arrivals move inspected rows                             | Latest 500 received actions queue behind New actions; applying explicitly updates history                                    | Queuing, snapshot, page-size and cancellation regressions                  |
| Live ON/OFF does not show connection or freshness             | Connecting/live/reconnecting/paused phases plus last action received timestamp                                               | Stream phase/freshness and real-client integration tests                   |
| Misleading finality countdown and stale stream LIB            | Actual block-vs-LIB state, visible help, newer HTTP/stream LIB wins; browser timer checks pending history until irreversible | Chain/account unit tests and transaction E2E                               |
| Resource meaning/units undiscoverable                         | Resource disclosure; CPU microseconds, NET/RAM bytes, transaction word-to-byte conversion                                    | Resource/unit tests; rendered 8.36 KiB / 256 KiB and 152-byte transaction  |
| Long IDs lack obvious copying                                 | Reusable copy control for key, transaction, block and chain IDs with success/failure feedback                                | Clipboard E2E verifies complete values                                     |
| Hidden search keyboard shortcut                               | Search-help disclosure and shortcut metadata                                                                                 | Shortcut/focus E2E                                                         |
| Missing account has generic retry feedback                    | Distinct not-found heading names account and chain; outages remain retryable                                                 | Named 404 and independent 503 recovery E2E                                 |
| Empty and unavailable chain/producer data conflated           | Resource errors propagate to scoped retry panels; empty text suppressed during failure                                       | Chain/producers outage and recovery E2E                                    |
| Empty transaction heading / incorrect finality comparison     | Transaction ID shown; LIB signal is invoked and compared with the transaction block                                          | Transaction route, copy and finality checks                                |
| Ordinary contract strings become bogus account links          | Only known account fields link to account pages; strings such as locked remain text                                          | Contract E2E and data-view source                                          |
| Price precision and amplified chart values                    | Formatted market precision, actual returned values, themed axes/series                                                       | Oracle/price controls E2E and chart source                                 |
| Chain ID dominates useful chain state                         | Head/LIB/time lead; identity/server details and copy live in a secondary disclosure                                          | Mobile Chain Stats screenshot and clipboard E2E                            |
| Theme picker hidden behind heart; opening changes palette     | Explicit Theme action; current-appearance placeholder; per-chain overrides and Chain default reset                           | Nine-preset persistence/reset and chain-identity tests                     |
| Account stylesheet above warning budget                       | Removed obsolete animation/control styles without raising the budget                                                         | Warning-free production browser/SSR build                                  |

## Detector and evidence disposition

The final manual `impeccable detect --json src/app` scan reports seven signals:

- Five Montserrat font notices: retained intentionally as part of the requested incumbent identity.
- Two missing-image notices: Angular `[src]`/`ngSrc` bindings, not missing rendered assets.
  The header image loads with nonzero natural width; the unavailable-logo case loads the
  single bundled fallback. The contract dialog references the bundled pulse SVG.
- The two baseline side-tab signals referred to one-pixel row/card borders, not navigation
  tabs. They no longer occur in the detector output.

Overlay repetition, nested-structure and occlusion counts were heuristic signals.
Clean browser views established the actual header/footer/chart defects above; overlay-only
horizontal overflow and blank full-page canvas captures were not product defects.
The synthetic dark stress case was followed by a dedicated themed fixture; it was never
evidence that every shipped light palette was broken.

Raw before/after detector data and screenshots remain local in the ignored
`.impeccable/critique` directory. Final confirmation captures include
`closure-account-desktop.png`, `closure-history-mobile.png`, `closure-stats-mobile.png`
and `closure-contract-dark.png`. The automated browser suite produces route screenshots
for both viewport classes.

Validation: typecheck, 123 unit tests in 38 files, five mock/published-client test results,
production browser/SSR build, and 54 Chromium desktop/mobile cases. The fixture covers
all route types, three chain identities and nine shipped appearance presets. Live chain,
consensus/reorganization, production backpressure, Safari and physical-device acceptance
remain separate release work, as documented in [local-lab.md](local-lab.md).
