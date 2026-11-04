import { expect, test } from "@playwright/test";

test("reports missing indexed history globally and updates on refresh", async ({ page, request }) => {
  await request.post("/__fixture/state", { data: { missingBlocks: 2687867, missingPct: "99.86%" } });
  await page.goto("/explorer/");
  const notice = page.locator(".history-coverage");
  await expect(notice).toContainText("2,687,867 blocks reported missing");
  await expect(notice).toContainText("99.86% of the reported indexed range");
  await expect(notice).toContainText("Recent blocks do not mean older history is complete.");
  await page.goto("/explorer/block/100");
  await expect(notice).toContainText("2,687,867 blocks reported missing");
  await page.waitForLoadState("networkidle");
  await request.post("/__fixture/state", { data: {} });
  await notice.getByRole("button", { name: "Refresh" }).click();
  await expect(notice).toHaveCount(0);
  await request.post("/__fixture/state", { data: { healthUnavailable: true } });
  await page.reload();
  await expect(notice).toContainText("History coverage is unavailable; results may be incomplete.");
  await request.post("/__fixture/state", { data: {} });
  const recovered = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/health" && response.status() === 200);
  await notice.getByRole("button", { name: "Retry" }).click();
  expect((await (await recovered).json()).health[0].service_data.missing_blocks).toBe(0);
  await expect(notice).toHaveCount(0);

  await request.post("/__fixture/state", { data: { healthMissingFields: true } });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(notice).toContainText("History coverage is unavailable; results may be incomplete.");
  const missingFields = page.waitForResponse(response => new URL(response.url()).pathname === "/v2/health" && response.status() === 200);
  await notice.getByRole("button", { name: "Retry" }).click();
  expect((await (await missingFields).json()).health[0].service_data).toEqual({});
  await expect(notice).toContainText("History coverage is unavailable; results may be incomplete.");
  await request.post("/__fixture/state", { data: {} });
});
