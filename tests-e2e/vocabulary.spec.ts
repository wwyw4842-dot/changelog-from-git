import { test, expect } from "./fixtures";

test("saved vocabulary retains learning history and serializes concurrent activity", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  const result = await page.evaluate(async () => {
    const send = (type: string, payload: unknown) => chrome.runtime.sendMessage({type,payload});
    const input = {word:"regression",translation:"test",context:"context",examples:["local fixture"]};
    const first = await send("vocabulary:add",input);
    const reviewed = await send("vocabulary:review",{id:first.data.id,quality:5});
    const again = await send("vocabulary:add",input);
    const before = await send("stats:daily",{});
    const writes = await Promise.all(Array.from({length:20},(_,i)=>send("vocabulary:add",{...input,word:`parallel${i}`})));
    const after = await send("stats:daily",{});
    return {reviewed,again,before,after,writes};
  });
  for (const field of ["id","addedAt","nextReviewAt","easeFactor","interval","reps","lapses"])
    expect(result.again.data[field]).toEqual(result.reviewed.data[field]);
  expect(result.writes.every(response=>response.ok)).toBe(true);
  expect(result.after.data.today.vocabAdded-result.before.data.today.vocabAdded).toBe(20);
  await page.reload();
  const stored = await page.evaluate(() => chrome.runtime.sendMessage({type:"vocabulary:list",payload:{limit:100}}));
  expect(stored.data).toHaveLength(21);
  expect(stored.data.find((row: {word:string})=>row.word==="regression").reps).toBe(1);
});
