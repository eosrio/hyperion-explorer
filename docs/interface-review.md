# Explorer interface critique and refinement

Baseline review: October 21, 2026, before interface changes. Score **22/40**, with
four P1 and no P0 findings. The baseline score is not an after-change certification.
Method: dual-agent (A: critique_design · B: critique_evidence)

Baseline: src/app at 354fb6e49b3ec3bd53a9b66939191fcd39b0761f, populated local fixtures, 2026-10-21.

The baseline critique is **22/40**. Hyperion has a recognizable identity worth keeping: the pulse mark, pale blue palette, soft panels, universal search, and chain-specific branding. The main problems are navigation geometry, inconsistent controls, and a few misleading data displays.

| Heuristic        | Score | Main finding                                                                    |
| ---------------- | ----: | ------------------------------------------------------------------------------- |
| System status    |   2/4 | Live mode shows ON/OFF, but freshness and finality need clearer treatment.      |
| Domain fit       |   3/4 | Blockchain terminology fits; holder units and percentages are inconsistent.     |
| User control     |   2/4 | Contract and holder pages lose the main search/navigation shell.                |
| Consistency      |   2/4 | Standalone pages, selected controls, and theme treatment diverge.               |
| Error prevention |   3/4 | Search recognition, constraints, and disabled controls provide a good base.     |
| Recognition      |   2/4 | Several icon controls and detail actions are unnamed or hard to discover.       |
| Efficiency       |   3/4 | Filters, sorting, pagination, and table modes are useful; keyboard gaps remain. |
| Visual clarity   |   2/4 | Large headers, deep shadows, and dense toolbars compete with the data.          |
| Error recovery   |   2/4 | Retry patterns exist, but some failures appear as empty results.                |
| Help             |   1/4 | Resource units, shortcuts, and chart percentages need clearer context.          |

What works is the investigative flow: search once, then follow accounts, keys, actions, transactions, and blocks. The existing theme variables and configurable logos also give us the right foundation for refinement across chains.

The five priorities are:

1. **[P1] Make header geometry reliable.** The compact header shows two logos, and the mobile header plus sticky account summary consumes too much working space. Consolidate the logo and search controls and give content a predictable offset. Suggested commands: optimize, animate.
2. **[P1] Make investigative controls keyboard accessible.** Streaming, action details, contract row expansion, and several reload/view controls need native semantics, accessible names, and visible state. Collapsed Chain Details currently remains keyboard reachable. Suggested commands: audit, harden.
3. **[P1] Keep every page inside the same themed explorer.** Contract and holder pages lack the shared shell. Selected scope text has 1:1 contrast, and the Producers table extends beyond an 800px wrapper into the footer. Fix these through shared layout and theme tokens. Suggested commands: adapt, polish.
4. **[P1] Correct holder information.** The SEED chart labels its balances as SYS, mobile chart labels clip, and percentages do not explain their denominator. Use the requested symbol consistently and pair a simpler chart with a readable ranked table. Suggested commands: clarify, harden.
5. **[P2] Reduce history control clutter.** Six filters, display preferences, streaming, LIB refresh, and pagination create too many simultaneous decisions. Group the controls while retaining the existing capabilities. Suggested commands: distill, layout.

The cognitive-load review found excess complexity in account history and contract browsing: weak grouping and hierarchy make users process controls before evidence. The calm entry becomes less reassuring when navigation shifts or token units disagree. For a power user, the main friction is control density; for a keyboard user, it is unreachable actions; for a mobile user, it is the space consumed by fixed chrome.

Smaller fixes include clearer missing-account feedback, transaction ID/finality display, price precision, and preventing ordinary contract strings such as active from becoming account links.

The static detector reported **17 signals**: nine overused-font, six broken-image, and two side-tab findings. The broken-image signals were Angular-binding false positives. Montserrat is part of the retained design, so its font warnings do not justify replacing it. Browser inspection confirmed the layout and control defects above. A temporary dark-theme stress test exposed hardcoded neutral colors; it does not establish that shipped light themes are broken.

The targeted questions were answered by the user: preserve pale blue and soft panels with lighter shadows/cleaner spacing; keep balances/resources first on mobile; queue live arrivals behind a New actions button. Per-chain themes remain required.

## Implemented response

- One chain logo/search form replaces the duplicate header and measurement-driven animation.
  Scroll progress is bounded and written once per animation frame; reduced motion stays compact.
  Data is visible immediately. Mobile keeps balances/resources above history.
- Pale blue and soft panels remain; shadows are lighter. Shared controls use chain tokens.
  Contract and holder routes keep the explorer shell. Appearance storage is scoped by chain ID.
- Streaming, row expansion, reloads and details use keyboard-operable controls with names/states.
  Live arrivals queue behind New actions; leaving the account cancels the subscription.
- Producers remain in normal document flow. Holder units follow the requested symbol, and
  percentages explicitly use displayed-holder balances. Contract strings do not become bogus links.
- Retryable API errors remain separate from empty results. Transaction IDs/finality, contract
  scope limit/sorting and price formatting were corrected. Price charts plot actual values.

## Run notes

Target slug: `src-app`; no detector ignore list was added. Two independent assessments were
completed. A finished before detector findings entered the parent synthesis; B's core evidence
was already recorded before a status-only agent listing exposed A's completed answer, with only
its bootstrap-error scenario outstanding. The findings were not revised to match A.

CLI baseline: 17 signals (9 font, 6 image, 2 side-tab). Post-edit scan: 7 signals
(5 font, 2 image). Montserrat belongs to the retained visual identity. The two remaining
image signals refer to Angular bindings in shared-header/contract-dialog markup;
browser checks verify the actual shared-header image. No colored side-tab findings remain.

The browser overlay was injected during evidence gathering. Visibility was unsupported in the
subagent context, so no user-visible overlay is claimed. Its temporary server, tabs, viewport
and injected styles were cleaned up. The report-body temporary file was removed. Raw screenshots
and detector JSON stay local under the ignored `.impeccable/critique` directory.

Snapshot write succeeded at `2026-10-21T16-28-55Z__src-app.md`. This is the first snapshot for
this target; no earlier trend exists. The baseline critique was delivered in chat before persistence.
The offline lab guide describes reproducible routes/scenarios and the limits of mock validation.

## Local validation

The refinement was checked with 114 unit tests, the real published streaming client
against the fixture (5 Node test results), production SSR/browser compilation, and
30 Chromium desktop/mobile browser cases. Those cases exercise every route type,
three chain identities, all nine shipped appearance presets, lossless sequences,
queued streaming, reconnect/cancellation, empty holders and retryable recovery.
The existing account stylesheet still emits a non-failing 10.96 kB / 10 kB warning.
The mock does not replace live Hyperion 4.5 server/chain qualification.
