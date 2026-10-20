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
  await expect(page.locator("#global-loader")).toHaveCount(0);
  await expect(page.locator("app-layout-transition").first().locator("img")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true, animations: "disabled" });
});

test("searches an account and retains block navigation", async ({ page }, testInfo) => {
  await page.goto("/explorer/");
  await page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" }).fill("eosio");
  await page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" }).press("Enter");
  await expect(page).toHaveURL(/\/explorer\/account\/eosio/);
  await expect(page.locator("#account-content")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("account.png"), fullPage: true, animations: "disabled" });
  await page.goto("/explorer/block/100");
  await expect(page.getByText("Block ID:", { exact: true })).toBeVisible();
  await expect(page.getByText("Irreversible", { exact: true })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Toggle actions for transaction " + "f".repeat(64) });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
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
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("#account-content")).toBeVisible();
  await page.goto("/explorer/block/100");
  await expect(page.getByText("Block ID:", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Block ID:", { exact: true })).toBeVisible();
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
  await dialog.getByRole("button", { name: "Toggle auth_sequence", exact: true }).click();
  await dialog.getByRole("button", { name: "Toggle 0", exact: true }).first().click();
  await expect(dialog.getByText("9007199254740993", { exact: true }).first()).toBeVisible();
});

test("uses the unrounded snapshot bound for filtered history", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { sequences: ["18446744073709551615", "9007199254740993"] } });
  await page.goto("/explorer/account/eosio");
  const filtered = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === "/v2/history/get_actions" && url.searchParams.get("act.name") === "transfer";
  });
  await page.getByRole("button", { name: "Native Transfers", exact: false }).click();
  expect(new URL((await filtered).url()).searchParams.get("global_sequence")).toBe("0-18446744073709551615");
  await expect(page.getByText("Sequence 9007199254740993", { exact: true })).toBeVisible();
});

test("reports unsafe legacy sequence numbers and recovers with exact strings", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { unsafeSequence: true } });
  await page.goto("/explorer/account/eosio");
  await expect(page.getByRole("alert")).toContainText("unsafe numeric values cannot be recovered");
  await request.post("/__fixture/state", { data: { sequences: ["9007199254740993"] } });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Sequence 9007199254740993", { exact: true })).toBeVisible();
});
