# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Polyglot** (`package.json` name: `polyglot`, v2.0.0) is an AI-powered language
assistant browser extension for Chrome/Edge (Manifest V3). It provides
selection translation, a multi-engine translation matrix, LLM "deep reading",
a vocabulary notebook with SM-2 spaced repetition, immersive full-page
translation, PDF/OCR, and input-box enhancement.

The repo began life as a single-file Python changelog generator; that history
still shows in older tags and in `CHANGELOG.md`, but the codebase is now the
TypeScript extension described here. `README.md` is the most detailed
user/architecture reference (written in Chinese) and is worth reading.

## Tech stack

- **Build:** Vite 5 + `@crxjs/vite-plugin` (MV3 bundling & HMR)
- **UI:** React 18 + TypeScript (strict) + TailwindCSS 3 (+ PostCSS, Autoprefixer)
- **State/data:** Zustand, Dexie (IndexedDB), Zod (validation)
- **OCR:** tesseract.js (lazy-loaded from CDN on first use)
- **Tests:** Vitest (jsdom) for unit, Playwright for e2e
- **Lint/format:** ESLint (TS + React) + Prettier

## Commands

```bash
npm install          # install deps (first run)
npm run dev          # Vite + CRXJS dev server with extension HMR
npm run build        # tsc -b && vite build → dist/
npm run preview      # preview a production build
npm run lint         # eslint "src/**/*.{ts,tsx}"
npm run format       # prettier --write
npm test             # vitest run (unit)
npm run test:watch   # vitest watch
npm run test:e2e     # playwright test (tests-e2e/)
npm run test:e2e:ui  # playwright --ui
```

Load the unpacked extension from `dist/` via `chrome://extensions/` (or
`edge://extensions/`) with developer mode enabled.

CI (`.github/workflows/ci.yml`) runs **lint → build → test** on Node 18 for
pushes/PRs to `main`/`master`. Keep all three green.

## Layout

The manifest is defined in code at `manifest.config.ts` (MV3: background
service worker, content script, popup, options page, side panel, commands,
host permissions). Entry points and source live under `src/`:

- `src/background/` — MV3 service worker (`service-worker.ts`) plus `handlers/`
  (translation, stream, tts, settings, vocabulary). Routes messages, owns the
  context menu, keyboard commands, and the streaming Port.
- `src/content/` — content script `bootstrap.ts` coordinator and feature
  controllers: `bubble/` (Shadow-DOM floating bubble), `immersive/` (full-page
  translation), `pdf/`, `ocr/`, `inputEnhance/`, `vocabHighlight/`.
- `src/providers/` — translation engine abstraction. `types.ts` defines
  `TranslationProvider`; `registry.ts` does primary-engine + fallback-chain
  dispatch; `cache.ts` is an LRU backed by `chrome.storage.local`. Classic
  engines (`google`, `bing`, `deepl`, `volcano`, `mymemory`) plus `llm/`
  (OpenAI, Claude, Gemini, Ollama, DeepSeek) which stream.
- `src/shared/` — cross-cutting code: `messaging.ts` (typed bus), `storage/`
  (`settings`, `history`, `vocabulary` SM-2, `crypto`, `db`), `i18n.ts`,
  `validation.ts`, `utils.ts`, theme/UI hooks.
- `src/sidepanel/`, `src/options/`, `src/popup/` — React + Tailwind UIs.
- `tests-e2e/` — Playwright specs and fixtures.

TypeScript path aliases (see `tsconfig.json`): `@/*` → `src/*`,
`@shared/*` → `src/shared/*`, `@providers/*` → `src/providers/*`.

## Architecture notes

- **Typed message bus** (`src/shared/messaging.ts`): a mapped type pins each
  channel's request/response types in one dictionary, avoiding stringly-typed
  `switch (message.type)`.
- **Provider abstraction**: every engine implements `TranslationProvider`. LLMs
  return `AsyncIterable<Partial<TranslationResult>>` for streaming; classic
  engines return once. `registry.translateViaChain` supports a primary engine,
  a fallback chain, and an `onChunk` callback.
- **Streaming channel**: content/sidepanel open a Port via
  `chrome.runtime.connect({ name: "polyglot-stream" })`; the background forwards
  chunks so tokens stream into the bubble or chat.
- **Shadow DOM + Tailwind**: `bubble.css` is imported `?inline`, compiled to a
  full Tailwind string, then injected into the Shadow Root via
  `adoptedStyleSheets` — zero style bleed to/from the host page.
- **SM-2 spaced repetition**: `reviewVocabulary(id, quality)` updates
  `easeFactor / interval / reps` per SM-2 (min ease 1.3). Covered by
  `src/shared/storage/vocabulary.test.ts`.
- **Encrypted storage**: `src/shared/storage/crypto.ts` generates a 256-bit
  AES-GCM master key at install (stored in `local`); API keys are saved as
  `enc:<base64>`. Sensitive fields stay out of `chrome.storage.sync`.

## Conventions

- TypeScript `strict` mode with `noUnusedLocals`/`noUnusedParameters` — unused
  symbols fail the build. Run `npm run lint` and `npm test` before pushing.
- Co-locate unit tests as `*.test.ts(x)` next to the code (Vitest `include`
  globs `src/**/*.test.ts(x)`). These are excluded from the tsconfig build.
- This repo dogfoods Conventional Commits (`type(scope): description`); the
  large `CHANGELOG.md` reflects that.
- Prefer the path aliases over deep relative imports.

## Leftover / non-extension files

- `changelog.py` — removed from the tree; ignore references to it in the old
  `CLAUDE.md` history.
- `count_lines.py`, `probe.txt` — small assessment-task artifacts, not part of
  the extension. Leave them alone unless asked.
- `.claude/skills/guizang-social-card-skill/` — a vendored Claude skill,
  unrelated to the extension build.

## Git workflow for this environment

- Develop on the branch you were assigned for the session; create it locally if
  needed.
- Push with `git push -u origin <branch>`, then open a **draft** PR if one does
  not already exist.
- Use the GitHub MCP tools (`mcp__github__*`) for GitHub operations — the `gh`
  CLI is not available here.
