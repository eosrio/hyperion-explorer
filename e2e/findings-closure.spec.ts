import { expect, test } from "@playwright/test";
const tx = "f".repeat(64);
const key = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5SoA82QKS2jD1xrF1vARe";
test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/state", { data: { manualStreaming: true } });
});

test("history controls preserve filtering, preferences and readable resource units", async ({ page }, info) => {
  await page.goto("/explorer/account/eosio");
  await expect(page.getByText("8.36 KiB / 256 KiB", { exact: true })).toBeVisible();
  await page.getByText("About resources", { exact: true }).click();
  await expect(page.getByText(/NET measures network bandwidth in bytes/)).toBeVisible();
  expect(await page.locator(".mat-expansion-panel-header button").count()).toBe(0);
  await page.getByRole("combobox", { name: "Action filter", exact: true }).selectOption({ label: "Native Transfers" });
  await expect(page.locator(".actions-table tbody tr")).not.toHaveCount(0);
  await expect(page.locator(".actions-table tbody tr").first()).toContainText("eosio.token");
  await page.getByRole("button", { name: "Clear filter", exact: true }).first().click();
  await page.getByText("Display options", { exact: true }).click();
  await page.getByLabel("Compact mode", { exact: true }).check();
  await expect(page.getByRole("button", { name: /Toggle action data/ }).first()).toBeVisible();
  await page
    .getByRole("button", { name: /Toggle action data/ })
    .first()
    .press("Enter");
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Rows per page", exact: true }).selectOption({ label: "10" });
  await expect(page.locator(".actions-table tbody tr")).toHaveCount(10);
  await page.locator("#actions-heading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("history-toolbar.png"), animations: "disabled" });
});

test("scope selection supports paging, direct scopes and empty rows without losing context", async ({ page, request }, info) => {
  await page.goto("/explorer/contract/vault.defi/vaults/alice");
  const scope = page.getByRole("combobox", { name: "Contract scope", exact: true });
  await expect(scope).toHaveValue("alice");
  await page.getByText("Scope options", { exact: true }).click();
  const limit = page.getByRole("spinbutton", { name: "Scope search limit" });
  await limit.fill("3");
  await limit.press("Tab");
  await expect(page.getByRole("button", { name: "Next scopes", exact: true })).toBeEnabled();
  const firstScopes = await scope.locator("option").allTextContents();
  await page.getByRole("button", { name: "Next scopes", exact: true }).click();
  await expect.poll(() => scope.locator("option").allTextContents()).not.toEqual(firstScopes);
  await page.getByRole("button", { name: "Previous scopes", exact: true }).click();
  await expect.poll(() => scope.locator("option").allTextContents()).toEqual(firstScopes);
  await page.getByRole("textbox", { name: "Custom scope", exact: true }).fill("bob");
  await page.getByRole("button", { name: "Load scope", exact: true }).click();
  await expect(page).toHaveURL(/\/vaults\/bob$/);
  await request.post("/__fixture/state", { data: { emptyTables: true } });
  const loaded = page.waitForResponse(response => response.url().includes("/v1/chain/get_table_rows") && response.ok());
  await page.reload();
  await loaded;
  await expect(page.getByText("No rows were returned for this scope.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("contract-controls.png"), animations: "disabled" });
});

test("identifiers can be copied without truncation and the search shortcut is discoverable", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const item of [
    { path: "/key/" + key, label: "public key", value: key },
    { path: "/transaction/" + tx, label: "transaction ID", value: tx }
  ]) {
    await page.goto("/explorer" + item.path);
    await page.getByRole("button", { name: "Copy " + item.label, exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(item.value);
  }
  await expect(page.getByText("152 bytes", { exact: true })).toBeVisible();
  await page.getByText("About finality", { exact: true }).click();
  await expect(page.getByText(/Pending activity can change until its block/)).toBeVisible();
  await page.locator("#search-help summary").click();
  await expect(page.locator("#search-help p")).toContainText("Shift");
  await page.keyboard.press("Control+Shift+f");
  await expect(page.getByRole("combobox", { name: "Account name, block number, transaction ID, or public key" })).toBeFocused();
  await page.goto("/explorer/block/100");
  await page.getByRole("button", { name: "Copy block ID", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^00000064[a-f0-9]{56}$/);
  await page.goto("/explorer/");
  await page.getByRole("button", { name: "Show Chain Details" }).click();
  await expect(page.getByText("Head block", { exact: true })).toBeVisible();
  await page.getByText("Chain identity and server", { exact: true }).click();
  await page.getByRole("button", { name: "Copy chain ID", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("a".repeat(64));
});

test("missing account and unavailable chain/producers retain distinct recovery states", async ({ page, request }) => {
  await page.goto("/explorer/account/zzzz");
  await expect(page.getByRole("heading", { name: "Account not found", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("zzzz");
  await request.post("/__fixture/state", { data: { chainUnavailable: true, producersUnavailable: true } });
  const unavailable = page.waitForResponse(response => response.url().includes("/v1/chain/get_info") && response.status() === 503);
  await page.goto("/explorer/");
  await unavailable;
  await page.getByRole("button", { name: "Show Chain Details" }).click();
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await page.getByRole("tab", { name: "Producers", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.getByText("No producers found.", { exact: true })).toHaveCount(0);
  await request.post("/__fixture/state", { data: {} });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("app-producers tbody tr")).toHaveCount(21);
});

test("stream connection and freshness are visible while queued history stays still", async ({ page, request }) => {
  await page.goto("/explorer/account/eosio");
  await page.getByRole("switch", { name: "Action live streaming" }).click();
  await expect(page.getByText("Live connection", { exact: true })).toBeVisible();
  await expect.poll(async () => (await (await request.get("/__fixture/state")).json()).connectedStreams).toBe(1);
  await request.post("/__fixture/stream", { data: { event: "emit" } });
  await expect(page.getByText(/Last action received/)).toBeVisible();
  await expect(page.getByText(/Live transfer 1/)).toHaveCount(0);
  await request.post("/__fixture/stream", { data: { event: "disconnect" } });
  await expect(page.getByText("Reconnecting", { exact: true })).toBeVisible();
  await expect(page.getByText("Live connection", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Action live streaming" }).click();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
});

test("unavailable configured logos fall back to one Hyperion mark", async ({ page }) => {
  await page.route("**/v2/explorer_logo", route => route.fulfill({ status: 404, body: "" }));
  await page.goto("/explorer/");
  await expect(page.locator("#header-container img")).toHaveCount(1);
  await expect(page.locator(".chain-logo")).toHaveAttribute("src", "assets/logo-hyperion-horz.svg");
  expect(await page.locator(".chain-logo").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("saved custom filters survive reload and can be deleted", async ({ page }) => {
  await page.goto("/explorer/account/eosio");
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
  await page.getByText("Custom filter", { exact: true }).click();
  await page.getByRole("textbox", { name: "Contract", exact: true }).fill("eosio.token");
  await page.getByRole("textbox", { name: "Action name", exact: true }).fill("transfer");
  await page.getByRole("checkbox", { name: "Save this filter" }).check();
  await page.getByRole("button", { name: "Apply filter", exact: true }).click();
  const select = page.getByRole("combobox", { name: "Action filter", exact: true });
  await expect(select).toHaveValue("eosio.token::transfer");
  await page.reload();
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
  await select.selectOption("eosio.token::transfer");
  await page.getByRole("button", { name: "Delete saved filter", exact: true }).click();
  await expect(select.locator("option", { hasText: "eosio.token::transfer" })).toHaveCount(0);
  await expect(select).toHaveValue("");
});

test("contract controls and search feedback retain readable contrast in every shipped palette", async ({ page }, info) => {
  await page.goto("/explorer/contract/vault.defi/vaults/alice");
  await expect(page.getByRole("button", { name: "Row 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search blockchain", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Search blockchain", exact: true }).click();
  await expect(page.locator("#search-error")).toBeVisible();
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  await page.getByRole("button", { name: "Choose explorer theme" }).click();
  const select = page.getByRole("combobox", { name: "Theme", exact: true });
  const measurements: Record<string, number[]> = {};
  for (const name of ["default", "jungle", "libre", "qry", "telos", "ultra", "vaulta", "wax", "xpr"]) {
    const loaded = page.waitForResponse(response => response.url().endsWith("/.internal/read_theme/" + name) && response.ok());
    await select.click();
    await page.getByRole("option", { name, exact: true }).click();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    const palette = await (await loaded).json();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()))
      .toBe(palette["--primary"].trim());
    await expect(select).toBeEnabled();
    measurements[name] = await page.locator(".grid-item-btn, select[aria-label='Contract scope'], #search-error").evaluateAll(elements => {
      const luminance = (color: string) => {
        const context = new OffscreenCanvas(1, 1).getContext("2d")!;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const rgb = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map(value => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      return elements.map(element => {
        const style = getComputedStyle(element);
        const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b);
        return (values[1] + 0.05) / (values[0] + 0.05);
      });
    });
    for (const ratio of measurements[name]) expect.soft(ratio, name).toBeGreaterThanOrEqual(4.5);
  }
  await info.attach("selected-control-contrast", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
});

test("dark chain controls inherit readable panel and icon colors", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { theme: "dark", manualStreaming: true } });
  await page.goto("/explorer/contract/vault.defi/vaults/alice");
  await expect(page.getByRole("button", { name: "Row 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search blockchain", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Search blockchain", exact: true }).click();
  await expect(page.locator("#search-error")).toBeVisible();
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  const controls = await page
    .locator(".grid-item-btn:not(.selected), button[aria-label='Reload scopes'], button[aria-label='Reload rows']")
    .evaluateAll(elements =>
      elements.map(element => ({
        foreground: getComputedStyle(element).color,
        expected: getComputedStyle(document.body).color,
        background: getComputedStyle(element).backgroundColor
      }))
    );
  expect(controls).toHaveLength(4);
  for (const control of controls) expect(control.foreground).toBe(control.expected);
  const ratios = await page.locator(".grid-item-btn:not(.selected), #search-error").evaluateAll(elements =>
    elements.map(element => {
      const context = new OffscreenCanvas(1, 1).getContext("2d")!;
      const luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map(value => value / 255)
          .map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const style = getComputedStyle(element);
      const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b);
      return (values[1] + 0.05) / (values[0] + 0.05);
    })
  );
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});
