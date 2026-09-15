/** Bound expensive requests and share duplicate work while it is queued/running. */
export function createTaskPool(limit = 3) {
  let active = 0;
  const queue: (() => void)[] = [];
  const pending = new Map<string, Promise<void>>();
  function drain() { while (active < limit && queue.length) queue.shift()!(); }
  return (key: string, task: () => Promise<void>): Promise<void> => {
    const existing = pending.get(key); if (existing) return existing;
    let resolve!: () => void, reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    pending.set(key, promise);
    queue.push(() => {
      active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        active--; pending.delete(key); drain();
      });
    });
    drain(); return promise;
  };
}
