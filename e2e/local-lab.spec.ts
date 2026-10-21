import { expect, test } from "@playwright/test";
const key = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5SoA82QKS2jD1xrF1vARe";

test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/state", { data: { manualStreaming: true } });
});

test("price history remains discoverable while its chart code is loading", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  let chartRequested = false;
  await page.route("**/*.js", async route => {
    const response = await route.fetch();
    const body = await response.text();
    if (/selectors:\s*\[\[\s*["'`]app-price-history["'`]\s*\]\]/.test(body)) {
      chartRequested = true;
      await held;
    }
    await route.fulfill({ response });
  });
  try {
    await page.goto("/explorer/");
    await expect(page.getByRole("button", { name: "Search blockchain", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Show Chain Details", exact: true }).click();
    await page.getByRole("tab", { name: "Price History", exact: true }).click({ timeout: 5000 });
    await expect.poll(() => chartRequested).toBe(true);
    await expect(page.getByRole("status")).toHaveText("Loading price history…");
    release();
    await expect(page.locator("#pair-select")).toHaveValue("sysusd");
    await expect(page.locator("app-price-history canvas")).toBeVisible();
  } finally {
    release();
    if (!page.isClosed()) await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("chain details remain in document flow and price controls use the local oracle", async ({ page }, info) => {
  await page.goto("/explorer/");
  await expect(page.locator("#expanded-content-area")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Show Chain Details" }).click();
  await page.getByRole("tab", { name: "Price History", exact: true }).click();
  await expect(page.locator("#pair-select")).toHaveValue("sysusd");
  await expect(page.locator("app-price-history canvas")).toBeVisible();
  await page.locator("#pair-select").selectOption("seedusd");
  await page.locator("#interval-select").selectOption("4h");
  await expect(page.getByText("SEEDUSD Current Price", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("prices.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("tab", { name: "Producers", exact: true }).click();
  await expect(page.locator("app-producers tbody tr")).toHaveCount(21);
  const lastRow = await page.locator("app-producers tbody tr").last().boundingBox();
  const footer = await page.locator("footer").boundingBox();
  expect(footer!.y).toBeGreaterThan(lastRow!.y + lastRow!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("producers.png"), fullPage: true, animations: "disabled" });
});

test("keys, contract tables and token-specific holders have the shared explorer shell", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/explorer/key/" + key);
  await expect(page.getByRole("link", { name: "alice", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("key.png"), fullPage: true, animations: "disabled" });
  await page.goto("/explorer/contract/vault.defi/vaults/alice");
  await expect(page.locator("#header-container img")).toHaveCount(1);
  const row = page.getByRole("button", { name: "Row 1", exact: true });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await row.press("Enter");
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await row.press("Enter");
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("9007199254740992", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "locked", exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("contract.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Table view", exact: true }).click();
  await expect(page.locator("#data-section table tr")).toHaveCount(9);
  await page.goto("/explorer/top-holders/seed.token/SEED");
  await expect(page.getByRole("heading", { name: "SEED Top Holders" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Balance · SEED" })).toBeVisible();
  await expect(page.locator(".holder-table tbody tr")).toHaveCount(10);
  await expect(page.getByText(/Shares are relative to the displayed holders/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("holders.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});

test("live actions queue without moving history and unsubscribe on navigation", async ({ page, request }) => {
  await page.goto("/explorer/account/eosio");
  const original = page.getByText("Fixture transfer", { exact: true });
  await expect(original).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Action live streaming" });
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await (await request.get("/__fixture/state")).json()).connectedStreams).toBe(1);
  // Allow history_end to release the streaming client's historical catch-up queue.
  await expect(page.getByText(/Listening for new actions/)).toBeVisible();
  await request.post("/__fixture/stream", { data: { event: "emit" } });
  const pending = page.getByRole("button", { name: /1 new action/i });
  await expect(pending).toBeVisible();
  await expect(page.getByText(/Live transfer 1/)).toHaveCount(0);
  await expect(original).toBeVisible();
  await pending.click();
  await expect(page.getByText(/Live transfer 1/)).toBeVisible();
  await request.post("/__fixture/stream", { data: { event: "disconnect" } });
  await expect.poll(async () => (await (await request.get("/__fixture/state")).json()).connectedStreams, { timeout: 10000 }).toBe(1);
  await request.post("/__fixture/stream", { data: { event: "emit" } });
  await expect(page.getByRole("button", { name: /1 new action/i })).toBeVisible();
  await page.getByRole("link", { name: "Hyperion Explorer home" }).click();
  await expect.poll(async () => (await (await request.get("/__fixture/state")).json()).connectedStreams).toBe(0);
});

test("chain logos and palettes persist across all routes with reduced motion", async ({ page, request }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["forest", "dark"]) {
    await request.post("/__fixture/state", { data: { theme, manualStreaming: true } });
    for (const route of [
      "/",
      "/account/eosio",
      "/block/100",
      "/transaction/" + "f".repeat(64),
      "/key/" + key,
      "/contract/vault.defi/vaults/alice",
      "/top-holders/seed.token/SEED"
    ]) {
      await page.goto("/explorer" + route);
      await expect(page.locator("#header-container img")).toHaveCount(1);
      await expect(page.locator("#global-loader")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), theme + route).toBe(true);
      expect(
        await page.locator("body").evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--main-background").trim())
      ).toBe(theme === "dark" ? "#172330" : "#e0ece5");
    }
    await page.screenshot({ path: info.outputPath(theme + "-holders.png"), fullPage: true, animations: "disabled" });
  }
});

test("holder outages recover explicitly and empty holders remain understandable", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { holdersUnavailable: true } });
  const failed = page.waitForResponse(response => response.url().includes("/v2/state/get_top_holders") && response.status() === 503);
  await page.goto("/explorer/top-holders/seed.token/SEED");
  await failed;
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await request.post("/__fixture/state", { data: { emptyHolders: true } });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText(/No holders were returned/)).toBeVisible();
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Reload holders" }).click();
  await expect(page.locator(".holder-table tbody tr")).toHaveCount(10);
});

test("all shipped appearance presets load, persist and reset to the chain palette", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { theme: "forest" } });
  await page.goto("/explorer/");
  await page.getByRole("button", { name: "Choose explorer theme" }).click();
  const select = page.getByRole("combobox", { name: "Theme", exact: true });
  for (const name of ["default", "jungle", "libre", "qry", "telos", "ultra", "vaulta", "wax", "xpr"]) {
    const loaded = page.waitForResponse(response => response.url().endsWith("/.internal/read_theme/" + name) && response.ok());
    await select.click();
    await page.getByRole("option", { name, exact: true }).click();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    const palette = await (await loaded).json();
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()))
      .toBe(palette["--primary"].trim());
    await expect(select).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  const applied = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary"));
  await page.reload();
  await expect(page.locator("#global-loader")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary"))).toBe(applied);
  await page.getByRole("button", { name: "Choose explorer theme" }).click();
  await select.click();
  await page.getByRole("option", { name: "Chain default", exact: true }).click();
  await expect(select).toBeEnabled();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--main-background").trim())).toBe(
    "#e0ece5"
  );
});
