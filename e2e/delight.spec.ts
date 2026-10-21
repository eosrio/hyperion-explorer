import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/state", { data: { manualStreaming: true } });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`explicit live batches acknowledge the new rows with ${reducedMotion} motion`, async ({ page, request }, info) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/explorer/account/eosio");
    const original = page.getByText("Fixture transfer", { exact: true });
    await expect(original).toBeVisible();
    await page.getByRole("switch", { name: "Action live streaming" }).press("Space");
    await expect(page.getByText("Listening for new actions", { exact: true })).toBeVisible();
    const before = await original.boundingBox();
    await request.post("/__fixture/stream", { data: { event: "emit" } });
    await request.post("/__fixture/stream", { data: { event: "emit" } });
    const pending = page.getByRole("button", { name: "2 New actions", exact: true });
    await expect(pending).toBeVisible();
    await expect(page.getByText(/Live transfer/)).toHaveCount(0);
    const after = await original.boundingBox();
    expect(Math.abs(before!.y - after!.y)).toBeLessThan(1);
    await pending.press("Enter");
    await expect(page.getByText("2 new actions in view", { exact: true })).toBeVisible();
    await expect(page.locator("tr.is-new-action")).toHaveCount(2);
    await expect(page.getByText(/Live transfer 2/)).toBeVisible();
    if (reducedMotion === "reduce") {
      expect(await page.locator(".signal-trace").evaluate(path => getComputedStyle(path).animationName)).toBe("none");
    }
    await page.screenshot({ path: info.outputPath("batch-received.png"), animations: "disabled" });
    await request.post("/__fixture/stream", { data: { event: "emit" } });
    await page.getByRole("button", { name: "1 New actions", exact: true }).press("Enter");
    await expect(page.getByText("1 new action in view", { exact: true })).toBeVisible();
    await expect(page.locator("tr.is-new-action")).toHaveCount(1);
    await page.getByRole("combobox", { name: "Action filter", exact: true }).selectOption({ label: "Native Transfers" });
    await expect(page.locator(".batch-receipt")).toHaveCount(0);
    await expect(page.locator("tr.is-new-action")).toHaveCount(0);
  });
}

test("copy confirmation stays visible, re-arms and preserves the full identifier", async ({ page, context }) => {
  const publicKey = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5SoA82QKS2jD1xrF1vARe";
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/explorer/key/" + publicKey);
  const button = page.getByRole("button", { name: "Copy public key", exact: true });
  await expect(button).toBeVisible();
  await button.press("Enter");
  await expect(button.getByText("Copied", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("public key copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(publicKey);
  await expect(button.getByText("Copy", { exact: true })).toBeVisible({ timeout: 5000 });
  await button.press("Enter");
  await expect(button.getByText("Copied", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(publicKey);
});
