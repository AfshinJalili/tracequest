import { expect, it } from 'vitest';
import demo from '../public/demo.json';
import { startReview, validatePack } from '@/domains/review';
import { loadReview, persistReview } from '@/persistence/review-storage';
it('restores a saved session with its selected step', () => {
  const session = startReview(validatePack(demo));
  persistReview(session);
  const restored = loadReview();
  expect(restored.kind).toBe('ready');
  if (restored.kind === 'ready')
    expect(restored.session.state.position).toEqual(session.state.position);
});
it('migrates the old numeric checkpoint without losing notes', () => {
  localStorage.setItem(
    'tracequest-v1',
    JSON.stringify({
      pack: demo,
      state: {
        status: {},
        stepStatus: {},
        notes: { 'fresh-owner': 'Keep this note' },
        position: { flow: 0, step: 1 },
        updated: 1,
      },
    }),
  );
  const restored = loadReview();
  expect(restored.kind).toBe('ready');
  if (restored.kind === 'ready') {
    expect(restored.session.state.position.step).toBe('fresh-owner');
    expect(restored.session.state.notes['fresh-owner']).toBe('Keep this note');
  }
});
it('reports corruption without pretending storage is empty', () => {
  localStorage.setItem('tracequest:v2', 'not json');
  expect(loadReview().kind).toBe('invalid');
});
it('persists only a domain session, not transient model credentials', () => {
  persistReview(startReview(validatePack(demo)));
  expect(localStorage.getItem('tracequest:v2')).not.toMatch(/apiKey|Authorization|endpoint/);
});
