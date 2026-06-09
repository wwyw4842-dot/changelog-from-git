# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Polyglot** — a Chrome MV3 extension (TypeScript + React + Vite + Tailwind) for AI-assisted language learning: selection-bubble translation, immersive page translation, vocabulary SRS, IELTS writing/speaking practice, OCR, and PDF support.

## Commands

```bash
npm run build        # tsc -b && vite build → dist/ (load this in chrome://extensions)
npm test             # vitest unit tests
npm run test:e2e     # Playwright e2e (builds dist/ first; loads the extension headless)
npm run lint         # eslint src/**/*.{ts,tsx}
npx vitest run src/providers/registry.test.ts   # single test file
```

## Architecture

Message flow: **content script / sidepanel / popup** → typed message bus (`@shared/messaging` `send()` / `MessageRouter`) or the `polyglot-stream` Port → **background service worker** → provider chain.

- `src/providers/` — translation engines behind one `TranslationProvider` interface, looked up via `registry.ts` (`translateViaChain` = primary + fallback chain + cache).
  - Free REST engines (google/bing/deepl/volcano) are built with `createRestProvider` (`rest-provider.ts`); language-code differences live in `lang-mapper.ts` only.
  - Streaming LLM engines (openai/claude/gemini/deepseek) are built with `createSSEProvider` (`llm/sse-provider.ts`); SSE/JSONL chunk parsing is shared via `llm/delta-parsers.ts`.
  - Freeform chat (`llm/chat.ts`) is an adapter table over the same parsers — add a new LLM by adding one adapter entry, not a new stream loop.
- `src/background/` — service worker. `handlers/` register on the MessageRouter; `translate-helper.ts` `runTranslation()` is the single enrich→chain→history pipeline; `handlers/stream.ts` owns the `polyglot-stream` Port.
- `src/shared/stream-protocol.ts` — the discriminated-union message types for that Port, used by **both** sides. Change the protocol here, never inline.
- `src/sidepanel/` — React app. Pages stream LLM output through the `useStreamPort()` hook (`hooks/useStreamPort.ts`); do not hand-roll `chrome.runtime.connect` in pages.
- `src/content/` — bootstrap + controllers (selection/bubble/shortcuts), bubble UI in Shadow DOM, immersive scanner, OCR, PDF hooks.
- `src/shared/storage/` — Dexie (IndexedDB) for settings/history/vocabulary/activity; API keys encrypted with WebCrypto AES-GCM (`crypto.ts`).

## Key Conventions

- Path aliases: `@/*` → `src/`, `@shared/*`, `@providers/*` (tsconfig + vite config must stay in sync).
- Provider errors are always `ProviderError` with a stable `code` (`EMPTY_TEXT`, `HTTP_ERROR`, `AUTHENTICATION_FAILURE`, `MISSING_CREDENTIALS`, `EMPTY_RESULT`, …) — the UI maps codes to Chinese user messages.
- Test files (`*.test.ts(x)`) are excluded from `tsc -b` (see tsconfig `exclude`); vitest type-checks them itself.
- `vite.config.ts` sets `base: "./"` — required for chrome-extension:// pages to resolve assets; do not remove.
- Adding a translation engine: implement via `createRestProvider`/`createSSEProvider`, register in `registry.ts`, add language quirks to `lang-mapper.ts`.
