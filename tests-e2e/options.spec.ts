import { test, expect } from "./fixtures";

test.describe("Foliole Options Page E2E Tests", () => {
  test("should load settings and successfully update settings", async ({ page, extensionId }) => {
    // 1. Navigate to Options settings page
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // 2. Assert page headers and brand titles are visible
    await expect(page.getByText("Foliole", { exact: true })).toBeVisible();
    await expect(page.getByText("设置中心", { exact: true })).toBeVisible();
    await expect(page.locator("img[src*='foliole-icon.svg']")).toBeVisible();

    const openPanelButton = page.getByRole("button", { name: "打开学习侧栏" });
    await expect(openPanelButton).toBeVisible();
    await expect(openPanelButton).toHaveCSS("min-height", "44px");
    const openCallsStubbed = await page.evaluate(() => {
      const scope = window as Window & { __folioleOptionsPanelCalls?: number };
      scope.__folioleOptionsPanelCalls = 0;
      return Reflect.set(chrome.sidePanel, "open", async () => {
        scope.__folioleOptionsPanelCalls = (scope.__folioleOptionsPanelCalls || 0) + 1;
      });
    });
    expect(openCallsStubbed).toBe(true);
    await openPanelButton.click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __folioleOptionsPanelCalls?: number })
              .__folioleOptionsPanelCalls || 0
        )
      )
      .toBe(1);
    await expect(page.getByRole("button", { name: "学习侧栏已打开" })).toBeVisible();

    // 3. Verify that the general settings card is active and general controls are shown
    const triggerModeSelect = page.locator("label:has-text('划词方式') select");
    await expect(triggerModeSelect).toBeVisible();

    // Check initial default value
    await expect(triggerModeSelect).toHaveValue("selection");

    // 4. Change trigger mode select option to "altSelection" (Alt key drag)
    await triggerModeSelect.selectOption("altSelection");

    // 5. Verify the "已保存" (Saved) auto-save toast/tag shows up
    const saveToast = page.locator("text=已保存");
    await expect(saveToast).toBeVisible({ timeout: 5000 });

    // 6. Test checkbox toggle for IELTS Mode
    const ieltsCheckbox = page.locator("label:has-text('雅思模式') input[type='checkbox']");
    await expect(ieltsCheckbox).toBeVisible();
    const isCheckedBefore = await ieltsCheckbox.isChecked();

    // Toggle ielts mode
    await ieltsCheckbox.click();

    // Wait for React to update checkbox state, then verify
    await expect(ieltsCheckbox).toBeChecked({ checked: !isCheckedBefore, timeout: 3000 });
    await expect(saveToast).toBeVisible({ timeout: 5000 });
  });

  test("should expose clear navigation and protect destructive actions", async ({
    page,
    extensionId,
  }) => {
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    const providersNav = page.getByRole("button", { name: /翻译服务/ });
    await providersNav.click();
    await expect(providersNav).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "翻译服务" })).toBeVisible();
    await expect(page.getByText("各项功能使用哪个服务")).toBeVisible();

    const advancedNav = page.getByRole("button", { name: /功能与数据/ });
    await advancedNav.click();
    await expect(page.getByRole("heading", { level: 1, name: "功能与数据" })).toBeVisible();

    await page.getByRole("button", { name: "清空历史" }).click();
    await expect(page.getByRole("alert")).toContainText("此操作无法撤销");
    await expect(page.getByRole("button", { name: "确认清空" })).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("button", { name: "确认清空" })).toHaveCount(0);
  });
});
