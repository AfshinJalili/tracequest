import { expect, it } from 'vitest';
import { requestSignal } from '@/integrations/request-signal';

it('keeps the deadline when a caller supplies cancellation', async () => {
  const caller = new AbortController();
  const signal = requestSignal(caller.signal, 15);
  await new Promise((resolve) => setTimeout(resolve, 45));
  expect(signal.aborted).toBe(true);
  expect(caller.signal.aborted).toBe(false);
});
it('still cancels immediately when the caller aborts', () => {
  const caller = new AbortController();
  const signal = requestSignal(caller.signal, 1000);
  caller.abort();
  expect(signal.aborted).toBe(true);
});
