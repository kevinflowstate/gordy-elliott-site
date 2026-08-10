export class OperationTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
  }
}

export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new OperationTimeoutError(operationName, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
