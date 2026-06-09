import { test, expect } from "./fixtures";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server: http.Server;
let serverUrl: string;

test.beforeAll(async () => {
  // Spawn a super lightweight local HTTP server with zero dependencies to host the test page
  server = http.createServer((req, res) => {
    const filePath = path.resolve(__dirname, "mock-page.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as any;
      serverUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.afterAll(() => {
  server.close();
});

test.describe("Polyglot Selection Bubble E2E Tests", () => {
  test("should inject __polyglot_host__ shadow DOM when text is double-clicked", async ({ page }) => {
    // 1. Load mock page on localhost
    await page.goto(serverUrl);
    await page.waitForLoadState("domcontentloaded");

    // 2. Locate word and simulate double-click to select word "polyglot"
    const targetWord = page.locator("#target-word");
    await targetWord.scrollIntoViewIfNeeded();
    
    // Simulate double click to trigger browser selection event
    await targetWord.dblclick();

    // 3. Assert that __polyglot_host__ div was injected into documentElement
    const host = page.locator("#__polyglot_host__");
    await expect(host).toBeAttached({ timeout: 5000 });

    // 4. Verify that the shadow root wrapper exists
    const rootMount = host.locator(".poly-root");
    await expect(rootMount).toBeAttached();
  });
});
