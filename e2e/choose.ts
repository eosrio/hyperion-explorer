import { expect, type Locator, type Page } from "@playwright/test";

/** The explorer's dropdowns are styled mat-selects: open one by its accessible name and pick an option. */
export function dropdown(page: Page, name: string): Locator {
  return page.getByRole("combobox", { name, exact: true });
}

export async function choose(page: Page, name: string, option: string): Promise<void> {
  await dropdown(page, name).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

/** Opens a dropdown, reads its option labels and closes it again without choosing. */
export async function optionLabels(page: Page, name: string): Promise<string[]> {
  await dropdown(page, name).click();
  const labels = (await page.getByRole("option").allTextContents()).map(label => label.trim());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  return labels;
}
