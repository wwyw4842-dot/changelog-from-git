import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { addVocabulary, reviewVocabulary } from "./vocabulary";
import { bumpActivity, getDailyStats } from "./activity";

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.vocabulary.clear();
  await db.activity.clear();
});

describe("persistent vocabulary transactions", () => {
  it("repeated save preserves every SRS field and omitted content", async () => {
    const first = await addVocabulary({word:" word ",translation:"one",context:"keep",tags:["tag"]});
    const reviewed = await reviewVocabulary(first.id!, 5);
    const repeated = await addVocabulary({word:"word",translation:"two"});
    for (const field of ["id","addedAt","nextReviewAt","easeFactor","interval","reps","lapses","context","tags"] as const)
      expect(repeated[field]).toEqual(reviewed[field]);
    expect(repeated.translation).toBe("two");
  });
  it("twenty concurrent writes preserve all vocabulary and counters", async () => {
    await Promise.all(Array.from({length:20},(_,i) => db.transaction("rw",db.vocabulary,db.activity,async()=>{
      await addVocabulary({word:`word${i}`,translation:"value"});
      await bumpActivity("vocabAdded");
    })));
    expect(await db.vocabulary.count()).toBe(20);
    expect((await getDailyStats()).today.vocabAdded).toBe(20);
  });
  it("same word concurrent saves remain one row", async () => {
    await Promise.all(Array.from({length:20},()=>addVocabulary({word:"same",translation:"value"})));
    expect(await db.vocabulary.count()).toBe(1);
  });
  it("activity failure rolls back vocabulary", async () => {
    vi.spyOn(db.activity, "put").mockRejectedValueOnce(new Error("storage failure"));
    await expect(db.transaction("rw",db.vocabulary,db.activity,async()=>{
      await addVocabulary({word:"rollback",translation:"value"});
      await bumpActivity("vocabAdded");
    })).rejects.toThrow("storage failure");
    expect(await db.vocabulary.count()).toBe(0);
    expect(await db.activity.count()).toBe(0);
  });
  it("independent increments are serialized", async () => {
    await Promise.all(Array.from({length:20},()=>bumpActivity("reviews")));
    expect((await getDailyStats()).today.reviews).toBe(20);
  });
});
