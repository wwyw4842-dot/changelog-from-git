import http from "node:http";
import { test, expect } from "./fixtures";

let server: http.Server;
let serverUrl: string;
let active = 0;
let peak = 0;
let started = 0;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    if (request.url !== "/api/chat") {
      response.writeHead(404).end();
      return;
    }
    request.resume();
    active += 1;
    started += 1;
    peak = Math.max(peak, active);
    response.on("close", () => {
      active -= 1;
    });
    response.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Access-Control-Allow-Origin": "*",
    });
    response.write(JSON.stringify({ message: { content: "partial" }, done: false }) + "\n");
    // Hold a real HTTP stream open so cancellation must abort the provider fetch.
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      serverUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    })
  );
});

test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("MV3 disconnect and replacement abort HTTP streams and release the shared budget", async ({
  page,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await expect(page.getByText("AI · 设置中心")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const settings = await chrome.runtime.sendMessage({ type: "settings:get" });
    return settings.data.migratedTo;
  })).toBe("1.0.0");
  await page.evaluate(async (apiBase) => {
    const settings = await chrome.runtime.sendMessage({
      type: "settings:update",
      payload: {
        credentials: { ollama: { apiBase } },
        fallbackChain: [],
      },
    });
    if (!settings.ok) throw new Error("settings update failed");
    const ports = Array.from({ length: 7 }, (_, index) => {
      const port = chrome.runtime.connect({ name: "polyglot-stream" });
      port.postMessage({
        type: "translate:stream",
        payload: {
          text: `cancel-test-${index}`,
          from: "en",
          to: "zh-CN",
          mode: "quick",
          providerId: "ollama",
        },
      });
      return port;
    });
    Object.assign(window, { __streamTestPorts: ports });
  }, serverUrl);
  await expect.poll(() => started).toBe(6);
  expect(active).toBe(6);
  expect(peak).toBe(6);

  await page.evaluate(() => {
    const ports = (window as unknown as { __streamTestPorts: chrome.runtime.Port[] })
      .__streamTestPorts;
    ports[6].disconnect(); // Queued work must never reach the provider.
    ports[0].disconnect();
  });
  await expect.poll(() => active).toBe(5);
  expect(started).toBe(6);

  await page.evaluate(() => {
    const ports = (window as unknown as { __streamTestPorts: chrome.runtime.Port[] })
      .__streamTestPorts;
    ports[1].postMessage({
      type: "translate:stream",
      payload: {
        text: "replacement",
        from: "en",
        to: "zh-CN",
        mode: "quick",
        providerId: "ollama",
      },
    });
  });
  await expect.poll(() => started).toBe(7);
  await expect.poll(() => active).toBe(5);
  expect(peak).toBeLessThanOrEqual(6);

  await page.evaluate(() => {
    const ports = (window as unknown as { __streamTestPorts: chrome.runtime.Port[] })
      .__streamTestPorts;
    ports.slice(1, 6).forEach((port) => port.disconnect());
  });
  await expect.poll(() => active).toBe(0);
});
