import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, "../dist");
    
    const context = await chromium.launchPersistentContext("", {
      headless: false, // Chrome extensions are only supported in headful or --headless=new modes
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        `--headless=new` // Allows headless extension testing in modern chromium
      ],
    });
    
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // Wait for the Service Worker to register and fetch the Extension ID
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }
    
    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
export { type Page } from "@playwright/test";
