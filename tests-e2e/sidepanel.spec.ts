import { test, expect } from "./fixtures";

test.describe("Foliole SidePanel E2E smoke", () => {
  test("shows the latest result and supports local navigation and actions", async ({
    context,
    page,
    extensionId,
  }) => {
    const latestSidePanelResult = {
      originalText: "serendipity",
      translatedText: "意外发现美好事物的运气",
      context: "Finding this quiet bookshop was pure serendipity.",
      provider: "e2e-local-provider",
      from: "en",
      to: "zh-CN",
      ts: 1_787_162_400_000,
    };

    const background = context.serviceWorkers()[0];
    expect(background, "the extension service worker should be available").toBeTruthy();
    await background.evaluate(async (result) => {
      await chrome.storage.local.set({ latestSidePanelResult: result });
      const scope = globalThis as typeof globalThis & { __folioleBlockedRequests?: Array<{ url: string; method: string; body?: BodyInit | null }> };
      scope.__folioleBlockedRequests = [];
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : String(input);
          scope.__folioleBlockedRequests?.push({ url, method: init?.method || "GET", body: init?.body });
          return new Response("", { status: 503 });
        },
      });
    }, latestSidePanelResult);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", {
        configurable: true,
        get: () => "zh-CN",
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            window.sessionStorage.setItem("foliole-e2e-copied-text", text);
          },
        },
      });
    });

    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (/^https?:\/\//.test(request.url())) externalRequests.push(request.url());
    });

    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/sidepanel.html`);

    const currentTab = page.getByRole("tab", { name: "当前结果", exact: true });
    const vocabularyTab = page.getByRole("tab", { name: "生词本", exact: true });
    const historyTab = page.getByRole("tab", { name: "最近记录", exact: true });

    await expect(currentTab).toHaveAttribute("aria-selected", "true");
    const result = page.getByTestId("latest-result");
    await expect(result).toContainText(latestSidePanelResult.originalText);
    await expect(result).toContainText(latestSidePanelResult.translatedText);
    await expect(result).toContainText(latestSidePanelResult.context);
    await expect(result).toContainText("EN → ZH-CN");
    await expect(result).toContainText(`由 ${latestSidePanelResult.provider} 翻译`);

    await result.getByRole("button", { name: "复制", exact: true }).click();
    await expect(page.locator('[role="status"]').filter({ hasText: "译文已复制" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.sessionStorage.getItem("foliole-e2e-copied-text")))
      .toBe(latestSidePanelResult.translatedText);

    await vocabularyTab.click();
    await expect(vocabularyTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "按日期", exact: true })).toBeVisible();

    await historyTab.click();
    await expect(historyTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "最近记录", exact: true })).toBeVisible();

    await currentTab.click();
    await expect(currentTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("latest-result")).toContainText(
      latestSidePanelResult.translatedText
    );

    await page.locator("summary").filter({ hasText: "更多" }).click();
    const moreMenu = page.getByRole("menu");
    await expect(moreMenu).toBeVisible();
    await expect(moreMenu.getByRole("menuitem", { name: "学习概览" })).toBeVisible();
    await expect(moreMenu.getByRole("menuitem", { name: "复习文章" })).toBeVisible();
    await expect(moreMenu.getByRole("menuitem", { name: "AI 追问" })).toBeVisible();

    await moreMenu.getByRole("menuitem", { name: "复习文章" }).click();
    await expect(page.locator("summary")).toHaveText("复习文章");
    await expect(page.getByText("暂无复习文章。去生词本生成后点击“保存”即可。")).toBeVisible();

    expect(externalRequests, "the smoke must not call a real provider or Folio").toEqual([]);
    const blockedRequests = await background.evaluate(() => {
      const scope = globalThis as typeof globalThis & { __folioleBlockedRequests?: Array<{ url: string; method: string; body?: BodyInit | null }> };
      return scope.__folioleBlockedRequests || [];
    });
    expect(blockedRequests).toEqual([{ url: "http://127.0.0.1:8787/api/v1/sync/state", method: "POST", body: "{}" }]);
  });
});
