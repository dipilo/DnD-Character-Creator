// dice-box drops pending roll promises on clear(), so scene teardown must settle our own wait.

/** A request, not a fault: the player turned 3D dice off mid-roll. */
export class DiceRollCancelledError extends Error {
  constructor() {
    super('The 3D roll was cancelled. You can roll again.');
    this.name = 'DiceRollCancelledError';
  }
}

export function isDiceRollCancelled(error: unknown): boolean {
  return error instanceof DiceRollCancelledError;
}

export function waitForDice<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DiceRollCancelledError());
      return;
    }
    const cancel = () => reject(new DiceRollCancelledError());
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return operation();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
