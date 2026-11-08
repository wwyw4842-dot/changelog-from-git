import { test, expect } from "./fixtures";

test.describe("Foliole Popup E2E", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  });

  test("makes the learning side panel the primary first-screen action", async ({ page }) => {
    await expect(page.locator(".foliole-popup-brand-mark")).toHaveAttribute(
      "src",
      "/public/icons/foliole-icon.svg"
    );
    await expect(page.getByRole("button", { name: "设置", exact: true })).toBeVisible();

    const openCallsStubbed = await page.evaluate(() => {
      const scope = window as Window & { __folioleSidePanelCalls?: chrome.sidePanel.OpenOptions[] };
      scope.__folioleSidePanelCalls = [];
      return Reflect.set(
        chrome.sidePanel,
        "open",
        async (options: chrome.sidePanel.OpenOptions) => {
          scope.__folioleSidePanelCalls?.push(options);
        }
      );
    });
    expect(openCallsStubbed).toBe(true);

    const primary = page.getByRole("button", { name: "打开学习侧栏", exact: true });
    await expect(primary).toBeVisible();
    const primaryBox = await primary.boundingBox();
    expect(primaryBox?.height).toBeGreaterThanOrEqual(44);
    expect((primaryBox?.y || 0) + (primaryBox?.height || 0)).toBeLessThanOrEqual(600);

    for (const label of ["当前结果", "生词本", "最近记录"]) {
      const shortcut = page.getByRole("button", { name: label, exact: true });
      await expect(shortcut).toBeVisible();
      expect((await shortcut.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: "生词本", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("foliole-sidepanel-tab")))
      .toBe("vocab");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scope = window as Window & {
            __folioleSidePanelCalls?: chrome.sidePanel.OpenOptions[];
          };
          return scope.__folioleSidePanelCalls?.length || 0;
        })
      )
      .toBe(1);
  });

  test("shows a visible error instead of swallowing side panel failures", async ({ page }) => {
    const openFailureStubbed = await page.evaluate(() =>
      Reflect.set(chrome.sidePanel, "open", async () => {
        throw new Error("side panel blocked for test");
      })
    );
    expect(openFailureStubbed).toBe(true);

    await page.getByRole("button", { name: "打开学习侧栏", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("未能打开侧栏，请刷新扩展后重试。");
  });
});
