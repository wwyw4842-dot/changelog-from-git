import { describe, it, expect } from "vitest";

function nextInterval(easeFactor: number, interval: number, reps: number, quality: number) {
  const nextEase = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  let nextReps = reps;
  let nextInterval: number;
  if (quality < 3) {
    nextReps = 0;
    nextInterval = 1;
  } else {
    nextReps += 1;
    if (nextReps === 1) nextInterval = 1;
    else if (nextReps === 2) nextInterval = 6;
    else nextInterval = Math.round(interval * nextEase);
  }
  return { nextEase, nextReps, nextInterval };
}

describe("SM-2 scheduling", () => {
  it("good answer first time schedules 1 day", () => {
    const r = nextInterval(2.5, 0, 0, 5);
    expect(r.nextInterval).toBe(1);
  });

  it("good answer second time schedules 6 days", () => {
    const r = nextInterval(2.5, 1, 1, 5);
    expect(r.nextInterval).toBe(6);
  });

  it("failed answer resets to 1 day and lowers ease", () => {
    const r = nextInterval(2.5, 6, 2, 2);
    expect(r.nextInterval).toBe(1);
    expect(r.nextReps).toBe(0);
    expect(r.nextEase).toBeLessThan(2.5);
  });

  it("ease cannot drop below 1.3", () => {
    const r = nextInterval(1.3, 1, 1, 0);
    expect(r.nextEase).toBeGreaterThanOrEqual(1.3);
  });
});
