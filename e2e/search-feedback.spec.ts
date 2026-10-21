import { expect, Page, test } from "@playwright/test";

const searchLabel = "Account name, block number, transaction ID, or public key";

test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/state", { data: { manualStreaming: true } });
});

async function expectContainedFeedback(page: Page) {
  const message = await page.locator("#search-error").boundingBox();
  const header = await page.locator("#header-container").boundingBox();
  const control = await page.locator(".search-control").boundingBox();
  expect(message!.y).toBeGreaterThanOrEqual(control!.y + control!.height + 7);
  expect(message!.y + message!.height).toBeLessThanOrEqual(header!.y + header!.height - 8);
  expect(message!.x).toBeGreaterThanOrEqual(0);
  expect(message!.x + message!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const content = await page.locator("#main-content").boundingBox();
  expect(content!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("search validation connects the field, feedback and recovery from a missing account", async ({ page }) => {
  await page.goto("/explorer/account/ssss");
  await expect(page.getByRole("heading", { name: "Account not found" })).toBeVisible();
  const search = page.getByRole("combobox", { name: searchLabel });
  const feedback = page.locator("#search-error");
  await expect(search).toBeEnabled();
  await expect(feedback).not.toBeVisible();
  await page.getByRole("button", { name: "Search blockchain", exact: true }).click();
  await expect(feedback).toHaveText("Enter an account, block, transaction ID or public key.");
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-invalid", "true");
  await expect(search).toHaveAttribute("aria-describedby", /search-error/);
  await expectContainedFeedback(page);

  await search.fill("unrecognized".repeat(20));
  await expect(feedback).not.toBeVisible();
  await expect(search).not.toHaveAttribute("aria-invalid", "true");
  await search.press("Enter");
  await expect(feedback).toHaveText("Search format not recognized. Check the search help.");
  await expectContainedFeedback(page);
  await search.fill("eosio");
  await expect(feedback).not.toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/account\/eosio$/);
  await expect(page.getByText("Fixture transfer", { exact: true })).toBeVisible();
  await expect(feedback).not.toBeVisible();
});

test("search feedback fits expanded and compact headers at narrow, tablet and desktop sizes", async ({ page }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/explorer/", "/explorer/account/ssss"]) {
        await test.step(`${width}px, ${reducedMotion}, ${route}`, async () => {
          await page.goto(route);
          const search = page.getByRole("combobox", { name: searchLabel });
          await expect(search).toBeEnabled();
          await search.press("Enter");
          await expect(page.locator("#search-error")).toBeVisible();
          await expectContainedFeedback(page);
        });
      }
    }
  }
});
