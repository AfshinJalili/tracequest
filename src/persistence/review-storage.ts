import { z } from 'zod';
import { decodeSession, stateSchema, validatePack, type ReviewSession } from '@/domains/review';
const KEY = 'tracequest:v2';
const legacySchema = z.object({
  pack: z.unknown(),
  state: stateSchema.omit({ position: true }).extend({
    position: z
      .object({ flow: z.number().int().nonnegative(), step: z.number().int().nonnegative() })
      .default({ flow: 0, step: 0 }),
  }),
});
export type StoredReview =
  | { kind: 'empty' }
  | { kind: 'ready'; session: ReviewSession }
  | { kind: 'invalid'; message: string };
export function loadReview(storage?: Pick<Storage, 'getItem'>): StoredReview {
  try {
    const adapter = storage ?? localStorage;
    const saved = adapter.getItem(KEY);
    if (saved) return { kind: 'ready', session: decodeSession(JSON.parse(saved)) };
    const old = adapter.getItem('tracequest-v1');
    if (!old) return { kind: 'empty' };
    const raw = legacySchema.parse(JSON.parse(old)),
      pack = validatePack(raw.pack),
      flow = pack.flows[raw.state.position.flow] ?? pack.flows[0],
      step = flow.steps[raw.state.position.step] ?? flow.steps[0];
    return {
      kind: 'ready',
      session: decodeSession({
        pack,
        state: { ...raw.state, position: { flow: flow.id, step: step.id } },
      }),
    };
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : 'Saved review could not be read.',
    };
  }
}
export function persistReview(
  session: ReviewSession,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    KEY,
    JSON.stringify({ ...session, state: { ...session.state, updated: Date.now() } }),
  );
}
