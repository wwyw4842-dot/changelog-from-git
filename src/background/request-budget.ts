const MAX_ACTIVE = 6;
const MAX_WAITING = 128;
let active = 0;
const waiting: Array<{
  signal: AbortSignal;
  start: () => void;
  cancel: () => void;
}> = [];

/** The worker shares this budget across ports, tabs, and stream providers. */
export function acquireRequestBudget(signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const aborted = (): DOMException => new DOMException("Translation cancelled", "AbortError");
    if (signal.aborted) {
      reject(aborted());
      return;
    }
    const entry = {
      signal,
      start: (): void => {
        signal.removeEventListener("abort", entry.cancel);
        active += 1;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          active -= 1;
          drain();
        });
      },
      cancel: (): void => {
        const index = waiting.indexOf(entry);
        if (index >= 0) waiting.splice(index, 1);
        signal.removeEventListener("abort", entry.cancel);
        reject(aborted());
      },
    };
    if (active < MAX_ACTIVE) entry.start();
    else if (waiting.length >= MAX_WAITING) reject(new Error("Translation request queue is full"));
    else {
      waiting.push(entry);
      signal.addEventListener("abort", entry.cancel, { once: true });
    }
  });
}

function drain(): void {
  while (active < MAX_ACTIVE && waiting.length) {
    const entry = waiting.shift()!;
    if (entry.signal.aborted) entry.cancel();
    else entry.start();
  }
}
