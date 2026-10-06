import { test, expect } from "./fixtures";
import http from "http";

let server: http.Server;
let serverUrl: string;

test.beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><style>body{margin:0}p{height:20px}</style>${Array.from({ length: 18 }, (_, i) => `<p>Paragraph ${i} with enough text for translation.</p>`).join("")}`
    );
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      serverUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
});

test.afterAll(() => server.close());

test("immersive translation stays bounded and ignores stale page responses", async ({
  page,
  context,
}) => {
  let active = 0;
  let peak = 0;
  await context.route("https://translate.googleapis.com/**", async (route) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 75));
    active -= 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sentences: [{ trans: "译文" }] }),
    });
  });
  await page.goto(serverUrl);
  await expect(page.locator("#__polyglot_host__")).toBeAttached({ timeout: 5000 });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("active tab unavailable");
    await chrome.tabs.sendMessage(tab.id, { type: "immersive:toggle", payload: { enable: true } });
  });
  await expect(page.locator("[data-polyglot-translation-host]")).toHaveCount(18, {
    timeout: 10000,
  });
  expect(peak).toBeLessThanOrEqual(6);

  await page.evaluate(() => {
    history.pushState({}, "", "/next");
    document.body.innerHTML = "<p>new page paragraph with enough text.</p>";
  });
  await expect(page.locator("[data-polyglot-translation-host]")).toHaveCount(1, { timeout: 3000 });
  await expect(page.locator("[data-polyglot-translation-host]")).toHaveText("译文");
});
