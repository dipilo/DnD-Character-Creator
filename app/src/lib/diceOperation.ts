// dice-box drops pending roll promises on clear(), so scene teardown must settle our own wait.
export function waitForDice<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('The 3D roll was cancelled. You can roll again.'));
      return;
    }
    const cancel = () => reject(new Error('The 3D roll was cancelled. You can roll again.'));
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return operation();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
