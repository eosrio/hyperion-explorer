import { expect, test } from "@playwright/test";

test("reports missing indexed history globally and updates on refresh", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { missingBlocks: 2687867, missingPct: "99.86%" } });
  await page.goto("/explorer/");
  const notice = page.locator(".history-coverage");
  await expect(notice).toContainText("2,687,867 blocks reported missing");
  await expect(notice).toContainText("99.86% of the reported indexed range");
  await expect(notice).toContainText("Recent blocks do not mean older history is complete.");
  const blockHealth = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/health");
  await page.goto("/explorer/block/100");
  await blockHealth;
  await expect(notice).toContainText("2,687,867 blocks reported missing");
  await request.post("/__fixture/state", { data: {} });
  await notice.getByRole("button", { name: "Refresh" }).click();
  await expect(notice).toHaveCount(0);
  await request.post("/__fixture/state", { data: { healthUnavailable: true } });
  await page.reload();
  await expect(notice).toContainText("History coverage is unavailable; results may be incomplete.");
  await request.post("/__fixture/state", { data: { healthMissingFields: true } });
  await notice.getByRole("button", { name: "Retry" }).click();
  await expect(notice).toContainText("History coverage is unavailable; results may be incomplete.");
  await request.post("/__fixture/state", { data: {} });
});
