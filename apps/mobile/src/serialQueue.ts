let tail: Promise<unknown> = Promise.resolve();
const inFlight = new Set<string>();

export function runSerial<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task);
  tail = result.catch(() => undefined);
  return result;
}

export function runGuarded<T>(key: string, duplicateMessage: string, task: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return Promise.reject(new Error(duplicateMessage));
  inFlight.add(key);
  return runSerial(task).finally(() => {
    inFlight.delete(key);
  });
}
