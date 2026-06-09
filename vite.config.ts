/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import manifest from "./manifest.config";

const require = createRequire(import.meta.url);

function copyFile(source: string, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function findPackageFile(
  packageName: string,
  matcher: (relativePath: string) => boolean,
  resolveFrom = __dirname
): string {
  const packageJson = require.resolve(`${packageName}/package.json`, { paths: [resolveFrom] });
  const packageRoot = path.dirname(packageJson);
  const stack = [packageRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      const relativePath = path.relative(packageRoot, fullPath).replace(/\\/g, "/");
      if (matcher(relativePath)) return fullPath;
    }
  }
  throw new Error(`Cannot find required tesseract asset in ${packageName}`);
}

function copyTesseractAssets() {
  return {
    name: "copy-tesseract-assets",
    apply: "build" as const,
    closeBundle() {
      const vendorDir = path.resolve(__dirname, "dist/vendor/tesseract");
      const langDir = path.join(vendorDir, "lang");
      const tesseractRoot = path.dirname(require.resolve("tesseract.js/package.json"));

      copyFile(
        require.resolve("tesseract.js/dist/tesseract.min.js"),
        path.join(vendorDir, "tesseract.min.js")
      );
      copyFile(
        require.resolve("tesseract.js/dist/worker.min.js"),
        path.join(vendorDir, "worker.min.js")
      );
      copyFile(
        findPackageFile(
          "tesseract.js-core",
          (file) => file.endsWith("tesseract-core.wasm.js"),
          tesseractRoot
        ),
        path.join(vendorDir, "tesseract-core.wasm.js")
      );
      copyFile(
        findPackageFile("@tesseract.js-data/eng", (file) => file.endsWith("eng.traineddata.gz")),
        path.join(langDir, "eng.traineddata.gz")
      );
      copyFile(
        findPackageFile("@tesseract.js-data/chi_sim", (file) =>
          file.endsWith("chi_sim.traineddata.gz")
        ),
        path.join(langDir, "chi_sim.traineddata.gz")
      );
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), crx({ manifest }), copyTesseractAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@providers": path.resolve(__dirname, "src/providers"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        sidepanel: "src/sidepanel/sidepanel.html",
        popup: "src/popup/popup.html",
        options: "src/options/options.html",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
  },
});
