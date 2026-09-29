# RP-GEN-03 / GEN-06 local repair evidence

Repeated vocabulary saves preserve existing SRS and omitted content fields. Vocabulary save/review and activity increments share an IndexedDB readwrite transaction; independent increments and row updates are serialized. Existing product semantics are retained: each successful save operation increments vocabAdded, including repeat saves; no schema migration or existing vocabulary deletion.

Original storage implementation fails 3 of the 5 new counterexample tests: repeat save changes nextReviewAt, 20 same-word concurrent writes create 20 rows, and 20 counter increments yield 1. Repaired implementation: 54/54 unit tests pass, build/lint pass. Real MV3 Chromium: original bubble and settings E2E plus new vocabulary test all pass (3/3); reviewed SRS unchanged, 20 concurrent saves acknowledged and counted, reload retains 21 words. New fake-indexeddb tests exercise actual Dexie rather than duplicating SM2 code.

Test setup: dependencies declared with lockfile; settings E2E polls persisted settings and reloads. Translate-plugin also fixes prefer-const in the original failed lint command; old remote CI run 26675795675 has expired logs (HTTP410), so do not claim to have read those logs. Both repos lacked architecture/sessions at these targets.

Remaining: independently review PRs and remote CI; GEN04 immersive queue/cancel history, and other unmapped historical PG IDs are not closed by this storage patch.
