# Translation request lifecycle

The content-side immersive queue deduplicates each visible block and starts at most six jobs. Stop or SPA navigation increments its generation and aborts all attached stream ports; terminal promises release their logical slots before the next job is pumped. Transient failures have two retries; the background waiting queue is capped at 128.

The service worker owns six shared provider leases across tabs and ports. A new request replaces the prior request on its port. Abort/disconnect invalidates its owner and forwards AbortSignal to fetch/stream parsers. A lease is released once the provider path settles, rather than when the UI abandons it. Late chunks, history, and cache writes are suppressed. Completion/error disconnects the content port.

Selection quick/deep cards share a generation, invalidated by replacement or dismissal. Input enhancement additionally binds a stream snapshot and undo text to its input. Restoration is conditional on the current text still matching the last stream output, so cancellation preserves newer edits. The stream's own synthetic input event is excluded from external-edit cancellation. Switching targets discards undo ownership.

Public request payloads and providers remain compatible. `createBubbleHost` accepts an optional dismissal callback; callers that omit it retain existing behavior. No storage schema or provider credential change is introduced by GEN-04.

Acceptance and delivery evidence are in `sessions/2026-10-07-gen04.md` and `sessions/evidence/gen04-red-summary.json`. Real account behavior, installation, release rollback, and stability observation are separate remaining gates.
