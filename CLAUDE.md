# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Foliole** (formerly **Polyglot**, `package.json` name: `polyglot`, v2.0.0) is a Chrome/Edge Manifest V3 extension (TypeScript + React + Vite + Tailwind) for AI-assisted language learning and reading: selection-bubble translation, immersive page translation, vocabulary capture with Folio FSRS-6 synchronization, IELTS writing/speaking practice, OCR, and PDF support.

## Commands

```bash
npm install          # install deps (first run)
npm run dev          # Vite + CRXJS dev server with extension HMR
npm run build        # tsc -b && vite build → dist/ (load in chrome://extensions)
npm run lint         # eslint "src/**/*.{ts,tsx}"
npm run format       # prettier --write
npm test             # vitest unit tests
npm run test:e2e     # Playwright e2e (builds dist/ first; loads extension)
npx vitest run src/providers/registry.test.ts   # single test file
```

## Architecture

Message flow: **content script / sidepanel / popup** → typed message bus (`@shared/messaging` `send()` / `MessageRouter`) or the `polyglot-stream` Port → **background service worker** → provider chain.

- `src/providers/` — translation engines behind `TranslationProvider`, dispatched via `registry.ts` (`translateViaChain` = primary + fallback chain + local Ollama fallback + cache + cancellation/timeouts).
  - Free REST engines (`google`/`bing`/`deepl`/`volcano`) are built with `createRestProvider` (`rest-provider.ts`); language-code differences live in `lang-mapper.ts`.
  - Streaming LLM engines (`openai`/`claude`/`gemini`/`deepseek`/`mimo`/`ollama`) use `createSSEProvider` (`llm/sse-provider.ts`) and shared `llm/delta-parsers.ts`.
  - Freeform chat (`llm/chat.ts`) is an adapter table over the same parsers.
- `src/background/` — MV3 service worker (`service-worker.ts`) and `handlers/`. `translate-helper.ts` `runTranslation()` is the shared enrich→chain→history pipeline; `handlers/stream.ts` owns the `polyglot-stream` Port with per-request `AbortController` and `request-budget.ts` concurrency leasing.
- `src/shared/stream-protocol.ts` — discriminated-union message types for `polyglot-stream` (`translate:stream`, `translate:stream:abort`, `llm:prompt`).
- `src/sidepanel/`, `src/options/`, `src/popup/` — React + Tailwind UIs. Sidepanel pages stream via `useStreamPort()`.
- `src/content/` — `bootstrap.ts` coordinator, Shadow-DOM `bubble/` (`BubbleHost.ts` cancels deep stream on hide), `immersive/` bounded viewport translation with SPA navigation reset, `pdf/`, `ocr/`, `inputEnhance/`, `vocabHighlight/`.
- `src/shared/storage/` — Dexie (`IndexedDB`) for `settings`, `history`, `vocabulary`, `syncOutbox`, `activity`, and `reviewArticles`; WebCrypto AES-GCM for API keys (`crypto.ts`); explicit Folio pairing token in `chrome.storage.local` (`folio-pairing.ts`) syncing durable capture/review outbox events with Folio's FSRS-6 authority (`vocabulary-sync.ts`).

## Conventions

- Path aliases: `@/*` → `src/*`, `@shared/*` → `src/shared/*`, `@providers/*` → `src/providers/*`.
- TypeScript `strict` mode with `noUnusedLocals`/`noUnusedParameters` — keep `npm run lint`, `npm test`, and `npm run build` green.
- Provider errors use `ProviderError` with stable error codes (`EMPTY_TEXT`, `HTTP_ERROR`, `AUTHENTICATION_FAILURE`, `MISSING_CREDENTIALS`, `EMPTY_RESULT`, `TIMEOUT`, …).
- Unit tests (`*.test.ts(x)`) are co-located under `src/` (and `tests/`), excluded from `tsc -b`, and run by Vitest.
- `vite.config.ts` keeps `base: "./"` so `chrome-extension://` pages resolve bundled assets.
