import { describe, expect, it } from "vitest";
import { acquireRequestBudget } from "./request-budget";

describe("shared translation request budget", () => {
  it("allows six requests and starts queued work as slots release", async () => {
    const controllers = Array.from({ length: 7 }, () => new AbortController());
    const leases = controllers.map((controller) => acquireRequestBudget(controller.signal));
    let settled = 0;
    for (const lease of leases.slice(0, 6)) {
      await lease;
      settled += 1;
    }
    let seventhStarted = false;
    void leases[6].then(() => {
      seventhStarted = true;
    });
    await Promise.resolve();
    expect(settled).toBe(6);
    expect(seventhStarted).toBe(false);
    const release = await leases[0];
    release();
    await Promise.resolve();
    expect(seventhStarted).toBe(true);
    for (const lease of leases.slice(1, 7)) (await lease)();
  });

  it("removes an aborted queued request without consuming a slot", async () => {
    const active = Array.from({ length: 6 }, () => new AbortController());
    const activeLeases = active.map((controller) => acquireRequestBudget(controller.signal));
    for (const lease of activeLeases) await lease;
    const queued = new AbortController();
    const queuedLease = acquireRequestBudget(queued.signal);
    queued.abort();
    await expect(queuedLease).rejects.toMatchObject({ name: "AbortError" });
    for (const lease of activeLeases) (await lease)();
  });
});
