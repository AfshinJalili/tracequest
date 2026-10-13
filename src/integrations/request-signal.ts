export function requestSignal(signal: AbortSignal | undefined, timeout: number): AbortSignal {
  return signal ?? AbortSignal.timeout(timeout);
}
