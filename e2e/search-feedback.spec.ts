import { expect, Page, test } from "@playwright/test";

const searchLabel = "Account name, block number, transaction ID, or public key";

test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/state", { data: { manualStreaming: true } });
});

async function expectContainedFeedback(page: Page) {
  await expect(async () => {
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing geometry target: ${selector}`);
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      return { message: rect("#search-error"), header: rect("#header-container"),
        control: rect(".search-control"), content: rect("#main-content"),
        viewport: innerWidth, documentWidth: document.documentElement.scrollWidth };
    });
    const { message, header, control, content } = geometry;
    expect(message.y).toBeGreaterThanOrEqual(control.y + control.height + 7);
    expect(message.y + message.height).toBeLessThanOrEqual(header.y + header.height - 8);
    expect(message.x).toBeGreaterThanOrEqual(0);
    expect(message.x + message.width).toBeLessThanOrEqual(geometry.viewport);
    expect(content.y).toBeGreaterThanOrEqual(header.y + header.height + 16);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
  }).toPass({ timeout: 5000 });
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
          if (reducedMotion === "reduce") {
            await expect(page.locator("#content-container")).toHaveCSS("transition-duration", "0s");
          }
          await expectContainedFeedback(page);
        });
      }
    }
  }
});

test("explains invalid account names and keeps the typed text", async ({ page }) => {
  const search = page.getByRole("combobox", { name: searchLabel });
  const feedback = page.locator("#search-error");
  await page.goto("/explorer/account/BAD!!");
  await expect(feedback).toHaveText(/"BAD!!" is not a valid account name/);
  await expect(search).toHaveValue("BAD!!");
  await search.fill("!!garbage??");
  await search.press("Enter");
  await expect(feedback).toHaveText(/"!!garbage\?\?" is not a valid account name/);
  await expect(search).toHaveValue("!!garbage??");
});

test("answers unknown routes with a not-found page and status", async ({ page }) => {
  const response = await page.goto("/explorer/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "go to the home page" })).toBeVisible();
});
