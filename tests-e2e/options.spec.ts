import { test, expect } from "./fixtures";

test.describe("Polyglot Options Page E2E Tests", () => {
  test("should load settings and successfully update settings", async ({ page, extensionId }) => {
    // 1. Navigate to Options settings page
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // 2. Assert page headers and brand titles are visible
    await expect(page.locator("text=Polyglot")).toBeVisible();
    await expect(page.locator("text=AI · 设置中心")).toBeVisible();

    // 3. Verify that the general settings card is active and general controls are shown
    const triggerModeSelect = page.locator("label:has-text('触发模式') select");
    await expect(triggerModeSelect).toBeVisible();
    
    // Check initial default value
    await expect(triggerModeSelect).toHaveValue("selection");

    // 4. Change trigger mode select option to "altSelection" (Alt key drag)
    await triggerModeSelect.selectOption("altSelection");

    // 5. Verify the "已保存" (Saved) auto-save toast/tag shows up
    const saveToast = page.locator("text=已保存");
    await expect(saveToast).toBeVisible({ timeout: 5000 });

    // 6. Test checkbox toggle for "开启雅思模式" (IELTS Mode)
    const ieltsCheckbox = page.locator("label:has-text('开启雅思模式') input[type='checkbox']");
    await expect(ieltsCheckbox).toBeVisible();
    const isCheckedBefore = await ieltsCheckbox.isChecked();

    // Toggle ielts mode
    await ieltsCheckbox.click();

    // Wait for React to update checkbox state, then verify
    await expect(ieltsCheckbox).toBeChecked({ checked: !isCheckedBefore, timeout: 3000 });
    await expect(saveToast).toBeVisible({ timeout: 5000 });
  });
});
