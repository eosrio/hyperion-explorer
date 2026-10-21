import { expect, test } from "@playwright/test";

test("Hyperion brand draws once, stays legible and becomes static with reduced motion", async ({ page, request }, info) => {
  await request.post("/__fixture/state", { data: {} });
  const asset = await request.get("/explorer/assets/logo-hyperion-horz.svg");
  const providerLogo = await request.get("/v2/explorer_logo");
  expect(asset.ok()).toBe(true);
  expect(await providerLogo.text()).toBe(await asset.text());

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/explorer/assets/logo-hyperion-horz.svg");
  const svg = page.locator("svg");
  await expect(svg).toHaveAccessibleName("Hyperion");
  const timing = await page.evaluate(() => document.getAnimations().map(animation => animation.effect!.getComputedTiming()));
  expect(timing.length).toBeGreaterThan(0);
  for (const animation of timing) {
    expect(animation.iterations).toBe(1);
    expect(Number(animation.endTime)).toBeLessThanOrEqual(3000);
  }
  expect(await page.locator(".base").count()).toBe(3);
  expect(await page.locator(".letter").evaluateAll(letters => letters.every(letter => Number(getComputedStyle(letter).opacity) > 0))).toBe(
    true
  );
  const entering = await svg.screenshot({ animations: "allow" });
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length))
    .toBe(0);
  const resting = await svg.screenshot({ animations: "allow", path: info.outputPath("hyperion-at-rest.png") });
  expect(entering.equals(resting)).toBe(false);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.locator(".trace").evaluateAll(paths => paths.every(path => getComputedStyle(path).strokeDashoffset === "0px"))).toBe(
    true
  );
  expect(await page.locator(".letter").evaluateAll(letters => letters.every(letter => getComputedStyle(letter).opacity === "1"))).toBe(
    true
  );
  await expect(page.locator(".em-blip")).toBeHidden();
  await svg.screenshot({ path: info.outputPath("hyperion-reduced-motion.png") });
});
