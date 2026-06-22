/**
 * 轻量级并发限流器。用于控制对翻译后端（尤其是速率限制严格的 LLM）的
 * 同时在途请求数量，避免 6 路并发流式请求触发 429 / 连接重置。
 *
 * 用法：
 *   const limit = createLimiter(2);
 *   await limit(() => send("translate:request", payload));
 *
 * 任务按入队顺序执行，最多同时运行 `concurrency` 个；其余排队等待。
 */
export type LimitedTask<T> = () => Promise<T>;

export interface Limiter {
  <T>(task: LimitedTask<T>): Promise<T>;
  /** 当前正在运行的任务数 */
  readonly active: number;
  /** 仍在排队等待的任务数 */
  readonly pending: number;
}

export function createLimiter(concurrency: number): Limiter {
  const max = Math.max(1, Math.floor(concurrency));
  const queue: Array<() => void> = [];
  let active = 0;

  const next = (): void => {
    if (active >= max) return;
    const run = queue.shift();
    if (!run) return;
    active += 1;
    run();
  };

  const limiter = (<T>(task: LimitedTask<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      };
      queue.push(run);
      next();
    });
  }) as Limiter;

  Object.defineProperty(limiter, "active", { get: () => active });
  Object.defineProperty(limiter, "pending", { get: () => queue.length });
  return limiter;
}
