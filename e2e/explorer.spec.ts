import { expect, test, Page } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/state", { data: {} });
});

test("renders behind /explorer with metadata that has no history watermark", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/explorer/");
  await expect(page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" })).toBeVisible();
  await expect(page).toHaveTitle("Fixture Chain Hyperion Explorer");
  await expect(page.getByText("Hyperion 4.5 Wire preview", { exact: true })).toHaveCount(0);
  await expect(page.locator("#global-loader")).toHaveCount(0);
  await expect(page.locator(".chain-logo")).toBeVisible();
  await expect(page.locator("#header-container img")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true, animations: "disabled" });
});

test("uses the configured system account for RAM market reads", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { systemContract: "sysio" } });
  const market = page.waitForRequest(req => req.method() === "POST" && new URL(req.url()).pathname === "/v1/chain/get_table_rows" && req.postDataJSON()?.table === "rammarket");
  await page.goto("/explorer/");
  const body = (await market).postDataJSON();
  expect(body.code).toBe("sysio");
  expect(body.scope).toBe("sysio");
});

test("waits for delayed metadata before selecting the system contract", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { systemContract: "sysio", metadataDelay: true } });
  const market = page.waitForRequest(req => req.method() === "POST" && new URL(req.url()).pathname === "/v1/chain/get_table_rows" && req.postDataJSON()?.table === "rammarket");
  await page.goto("/explorer/");
  expect((await market).postDataJSON().code).toBe("sysio");
  await page.waitForLoadState("networkidle");
  const calls = await (await request.get("/__fixture/requests")).json();
  const abis = calls.filter((entry: {path:string}) => entry.path === "/v1/chain/get_abi");
  expect(abis.length).toBeGreaterThan(0);
  expect(abis.every((entry: {body:{account_name:string}}) => entry.body.account_name === "sysio")).toBe(true);
});

test("defaults RAM market reads to eosio without a system account", async ({ page }) => {
  const market = page.waitForRequest(req => req.method() === "POST" && new URL(req.url()).pathname === "/v1/chain/get_table_rows" && req.postDataJSON()?.table === "rammarket");
  await page.goto("/explorer/");
  const body = (await market).postDataJSON();
  expect(body.code).toBe("eosio");
  expect(body.scope).toBe("eosio");
});

test("skips RAM market when the configured contract ABI does not declare it", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { systemContract: "sysio", noRamMarket: true } });
  await page.goto("/explorer/");
  await expect(page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" })).toBeVisible();
  await expect.poll(async () => (await (await request.get("/__fixture/requests")).json()).some((entry: {path:string;body?:{account_name?:string}}) => entry.path === "/v1/chain/get_abi" && entry.body?.account_name === "sysio")).toBe(true);
  await page.waitForLoadState("networkidle");
  const calls = await (await request.get("/__fixture/requests")).json();
  expect(calls.some((entry: {path:string;body?:{table?:string}}) => entry.path === "/v1/chain/get_table_rows" && entry.body?.table === "rammarket")).toBe(false);
});

test("renders missing, invalid and zero transaction NET usage truthfully", async ({ page, request }) => {
  const tx = "/explorer/transaction/" + "f".repeat(64);
  for (const [fixture, expected] of [[{ missingNetUsage: true }, "Unavailable"], [{ netUsageWords: -1 }, "Unavailable"], [{ netUsageWords: "19" }, "Unavailable"], [{ netUsageWords: 1125899906842624 }, "Unavailable"], [{ netUsageWords: 0 }, "0 bytes"], [{ netUsageWords: 19 }, "152 bytes"]] as const) {
    await request.post("/__fixture/state", { data: fixture });
    await page.goto(tx);
    await expect(page.locator("[data-testid=net-usage]")).toHaveText(expected);
  }
});

test("searches an account and retains block navigation", async ({ page }, testInfo) => {
  await page.goto("/explorer/");
  await page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" }).fill("eosio");
  await page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" }).press("Enter");
  await expect(page).toHaveURL(/\/explorer\/account\/eosio/);
  await expect(page.locator("#account-content")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("account.png"), fullPage: true, animations: "disabled" });
  await page.goto("/explorer/block/100");
  await expect(page.getByText("Block ID", { exact: true })).toBeVisible();
  await expect(page.getByText("Irreversible", { exact: true })).toBeVisible();
  await expect(page.getByText("Transactions and actions reflect the connected history service and may be incomplete.", { exact: true })).toBeVisible();
  await expect(page.locator("th").filter({ hasText: "First returned action" })).toHaveCount(1);
  const toggle = page.getByRole("button", { name: "Toggle actions for transaction " + "f".repeat(64) });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
});

test("renders a returned transaction with no action details", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { blockEmptyActions: true } });
  await page.goto("/explorer/block/100");
  await expect(page.getByText("No action details returned").first()).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
});

test("shows chain account and history when the state projection is unavailable", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, rpcRamQuota: "6744062231", noOracle: true } });
  await page.goto("/explorer/account/eosio");
  await expect(page.locator("#account-content")).toBeVisible();
  const gaps = page.getByRole("status", { name: "Partial account data" });
  await expect(gaps).toContainText("Core account data comes from the chain.");
  await expect(gaps.getByRole("listitem").filter({ hasText: "Token balances" })).toHaveCount(1);
  await expect(gaps.getByRole("listitem").filter({ hasText: "Permission links" })).toHaveCount(1);
  await expect(page.locator(".tokens-card")).toHaveCount(0);
  await expect(page.getByText("No tokens", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Indexed action history may be incomplete.")).toBeVisible();
  await expect(page.getByText(/USD (price unavailable|value)/)).toHaveCount(0);
  await expect(page.getByText(/6\.28 GiB/)).toBeVisible();
  await expect(page.locator(".actions-table tbody tr").first()).toBeVisible();
  const calls = await (await request.get("/__fixture/requests")).json();
  expect(calls.some((entry: { path: string }) => entry.path?.includes("/v1/chain/get_account"))).toBe(true);
  expect(calls.some((entry: { path: string }) => entry.path?.includes("/v2/history/get_actions"))).toBe(true);
  await request.post("/__fixture/state", { data: {} });
});

test("renders observed Wire resource types without inventing missing balances", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, wireOrdinaryShape: true, noOracle: true } });
  await page.goto("/explorer/account/eosio");
  await expect(page.getByText(/11\.17 GiB/)).toBeVisible();
  const gaps = page.getByRole("status", { name: "Partial account data" });
  for (const label of ["Liquid balance", "Stake breakdown", "Refunds"]) await expect(gaps.getByRole("listitem").filter({ hasText: label })).toHaveCount(1);
  await expect(page.locator("#balance-card")).toHaveCount(0);
  await expect(page.getByText("Total in CPU", { exact: true })).toBeVisible();
  await expect(page.getByText("Self-staked", { exact: true })).toHaveCount(0);
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, wireOrdinaryShape: true, omitTotalResources: true, noOracle: true } });
  await page.reload();
  await expect(page.getByText("Total in CPU", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Partial account data" }).getByRole("listitem").filter({ hasText: "Liquid balance" })).toHaveCount(1);
  await request.post("/__fixture/state", { data: {} });
});

test("renders observed Wire unlimited CPU and NET values", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, wireUnlimitedShape: true } });
  await page.goto("/explorer/account/eosio");
  await expect(page.getByText("Unlimited", { exact: true })).toHaveCount(2);
  await expect(page.getByText(/6\.28 GiB/)).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
});

test("qualifies an empty indexed account history", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true } });
  await page.goto("/explorer/account/empty");
  await expect(page.getByRole("region", { name: "Actions" })).toContainText("No actions to display");
  await expect(page.getByText("Indexed action history may be incomplete.")).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
});

test("preserves core account when action history is unavailable and retries it", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, actionsUnavailable: true } });
  const unavailable = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/history/get_actions" && response.status() === 503);
  await page.goto("/explorer/account/eosio");
  await unavailable;
  await expect(page.locator("#account-content")).toBeVisible();
  const history = page.getByRole("region", { name: "Actions" });
  await expect(history.getByRole("alert")).toContainText("Indexed action history is temporarily unavailable");
  await expect(history).not.toContainText("No actions to display");
  await expect(history.locator(".actions-table")).toHaveCount(0);
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true } });
  const restored = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/history/get_actions" && response.status() === 200);
  await history.getByRole("button", { name: "Retry history" }).click();
  await restored;
  await expect(page.locator(".actions-table tbody tr").first()).toBeVisible();
});

test("labels unavailable block delta projection without hiding the trace", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { deltasProjectionUnavailable: true } });
  const unavailable = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/history/get_deltas" && response.status() === 503);
  await page.goto("/explorer/block/100");
  await unavailable;
  await expect(page.getByText("Block ID", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle actions for transaction " + "f".repeat(64) })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Block state deltas are temporarily unavailable");
  await request.post("/__fixture/state", { data: {} });
  const restored = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/history/get_deltas" && response.status() === 200);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await restored;
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("keeps unlimited and unsafe RPC RAM quotas distinct", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, rpcRamQuota: "-1" } });
  await page.goto("/explorer/account/eosio");
  await expect(page.getByText("Unlimited", { exact: true }).first()).toBeVisible();
  await request.post("/__fixture/state", { data: { accountProjectionUnsupported: true, rpcRamQuota: "9007199254740992" } });
  await page.reload();
  await expect(page.getByText("usage unavailable", { exact: true })).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
});

test("keeps an unavailable projection isolated and allows explicit recovery", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { accountUnavailable: true } });
  // HTTP errors aren't transferred from SSR. Observe the browser's own failure before restoring the API.
  const unavailable = page.waitForResponse(
    response => new URL(response.url()).pathname === "/v2/state/get_account" && response.status() === 503
  );
  await page.goto("/explorer/account/eosio");
  await unavailable;
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  const failedCalls = await (await request.get("/__fixture/requests")).json();
  expect(failedCalls.some((entry: { path: string }) => entry.path === "/v1/chain/get_account")).toBe(false);
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("#account-content")).toBeVisible();
  await page.goto("/explorer/block/100");
  await expect(page.getByText("Block ID", { exact: true })).toBeVisible();
});

test("reports a transaction outage without turning it into not found", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { transactionUnavailable: true } });
  const unavailable = page.waitForResponse(
    response => new URL(response.url()).pathname === "/v2/history/get_transaction" && response.status() === 503
  );
  await page.goto("/explorer/transaction/" + "f".repeat(64));
  await unavailable;
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.getByText("Transaction not found", { exact: true })).toHaveCount(0);
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
});

test("keeps block history usable while delta history is unavailable", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { deltasUnavailable: true } });
  const unavailable = page.waitForResponse(
    response => new URL(response.url()).pathname === "/v2/history/get_deltas" && response.status() === 503
  );
  await page.goto("/explorer/block/100");
  await unavailable;
  await expect(page.getByText("Block ID", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("recovers the bootstrap screen after metadata becomes available", async ({ page, request }) => {
  test.setTimeout(15_000);
  await request.post("/__fixture/state", { data: { metadataUnavailable: true } });
  const unavailable = page.waitForResponse(
    response => new URL(response.url()).pathname === "/v2/explorer_metadata" && response.status() === 503
  );
  await page.goto("/explorer/");
  await unavailable;
  await expect(page.getByRole("heading", { name: "Unable to load the explorer" })).toBeVisible();
  await expect(page.getByText(/temporarily unavailable/)).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" })).toBeVisible();
});

test("preserves uint64 metadata and exact continuation cursors after SSR hydration", async ({ page, request }) => {
  const sequences = ["18446744073709551615", "9223372036854775808", "9007199254740993", "9007199254740992"];
  await request.post("/__fixture/state", { data: { sequences, initialActions: 2 } });
  await page.goto("/explorer/account/eosio");
  await expect(page.getByText(`Sequence ${sequences[0]}`, { exact: true })).toBeVisible();
  const continuation = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === "/v2/history/get_actions" && url.searchParams.get("limit") === "50";
  });
  await page.getByRole("button", { name: "Load more actions", exact: true }).click();
  expect(new URL((await continuation).url()).searchParams.get("global_sequence")).toBe("0-9223372036854775807");
  for (const sequence of sequences) await expect(page.getByText(`Sequence ${sequence}`, { exact: true })).toBeVisible();
  const row = page.locator("tr", { hasText: `Sequence ${sequences[0]}` });
  await row.getByText("Expand details", { exact: false }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(sequences[0], { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("9223372036854775808", { exact: true }).first()).toBeVisible();
  await dialog.getByText("All fields", { exact: true }).click();
  await dialog.getByRole("button", { name: "Toggle auth_sequence", exact: true }).click();
  await dialog.getByRole("button", { name: "Toggle 0", exact: true }).first().click();
  await expect(dialog.getByRole("treeitem", { name: "sequence 9007199254740993", exact: true })).toBeVisible();
});

test("uses the unrounded snapshot bound for filtered history", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { sequences: ["18446744073709551615", "9007199254740993"] } });
  await page.goto("/explorer/account/eosio");
  const filtered = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === "/v2/history/get_actions" && url.searchParams.get("act.name") === "transfer";
  });
  await page.getByRole("combobox", { name: "Action filter", exact: true }).selectOption({ label: "Native Transfers" });
  expect(new URL((await filtered).url()).searchParams.get("global_sequence")).toBe("0-18446744073709551615");
  await expect(page.getByText("Sequence 9007199254740993", { exact: true })).toBeVisible();
});

test("reports unsafe legacy sequence numbers and recovers with exact strings", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { unsafeSequence: true } });
  // Wait for the browser's load: SSR may show the error before hydration fetches it.
  const browserAccount = page.waitForResponse(
    response => new URL(response.url()).pathname === "/v2/state/get_account" && response.status() === 200
  );
  await page.goto("/explorer/account/eosio");
  await browserAccount;
  await expect(page.getByRole("alert")).toContainText("unsafe numeric values cannot be recovered");
  await request.post("/__fixture/state", { data: { sequences: ["9007199254740993"] } });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Sequence 9007199254740993", { exact: true })).toBeVisible();
});

test("names the chain in the header and links tokens to holders only when the API ranks them", async ({ page, request }) => {
  await page.goto("/explorer/account/eosio");
  await expect(page.locator(".provider .chain-name")).toHaveText("Fixture Chain");
  await expect(page.locator(".provider")).toContainText("Data by Local fixture");
  const holders = page.getByRole("link", { name: "Top SEED holders" });
  await expect(holders).toHaveAttribute("href", "/explorer/top-holders/seed.token/SEED");

  await request.post("/__fixture/state", { data: { holdersUnavailable: true } });
  await page.reload();
  await expect(page.locator(".token-list").getByText("SEED", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Top SEED holders" })).toHaveCount(0);
});

test("shows the live chain head on arrival and says when it is reconnecting", async ({ page, request }) => {
  await page.goto("/explorer/");
  const pulse = page.getByRole("region", { name: "Chain status" });
  await expect(pulse).toContainText("Live");
  await expect(pulse.getByRole("link", { name: "102", exact: true })).toHaveAttribute("href", "/explorer/block/102");
  await expect(pulse.getByRole("link", { name: "harborbp", exact: true })).toHaveAttribute("href", "/explorer/account/harborbp");
  await expect(pulse).toContainText("1 block behind head");

  await request.post("/__fixture/state", { data: { chainUnavailable: true } });
  await expect(pulse).toContainText("Reconnecting", { timeout: 6_000 });
  await expect(pulse.getByRole("link", { name: "102", exact: true })).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
  await expect(pulse).toContainText("Live", { timeout: 15_000 });
});
