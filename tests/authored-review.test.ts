import { describe, expect, it } from 'vitest';
import { authoredDemo, largeBackendFiles } from './review-fixture';
import {
  buildPack,
  decodeSession,
  inspectStep,
  reviewView,
  saveNote,
  startReview,
  validatePack,
  verifySourceSnapshot,
  type ReviewPack,
} from '@/domains/review';
import { loadReview, persistReview } from '@/persistence/review-storage';

describe('evidence intake and authored reviews', () => {
  it('keeps a 73-file NestJS-style import as evidence with zero invented steps', () => {
    const pack = buildPack({ title: 'Large backend module' }, largeBackendFiles());
    const view = reviewView(startReview(pack), new Set());
    expect(pack.files).toHaveLength(73);
    expect(pack.blocks.length).toBeGreaterThan(200);
    expect(pack.flows).toEqual([]);
    expect(view.kind).toBe('evidence');
    expect(view.steps.total).toBe(0);
    expect(view.coverage.unmapped).toBe(pack.blocks.length);
    expect(view.contextMissing.length).toBeGreaterThan(0);
    expect(startReview(pack).state.position).toBeNull();
  });
  it('does not promote previously exported symbol guesses or AI drafts into a review', () => {
    const sample = authoredDemo();
    const draft = validatePack({ ...sample, mapping: 'candidate', authorship: undefined });
    const view = reviewView(startReview(draft), new Set());
    expect(view.kind).toBe('evidence');
    expect(view.flows).toEqual([]);
    expect(view.mappingLabel).toBe('Needs curation');
  });
  it('rejects tampered code, altered ranges, missing blocks, and stale commits', () => {
    const pack = authoredDemo(),
      first = pack.blocks[0];
    expect(() =>
      validatePack({
        ...pack,
        blocks: [{ ...first, code: first.code + '\n+forged' }, ...pack.blocks.slice(1)],
      }),
    ).toThrow(/source ranges/);
    expect(() =>
      validatePack({
        ...pack,
        blocks: [{ ...first, start: first.start + 1 }, ...pack.blocks.slice(1)],
      }),
    ).toThrow(/source ranges/);
    expect(() => validatePack({ ...pack, blocks: pack.blocks.slice(1) })).toThrow(/source ranges/);
    expect(() =>
      validatePack({ ...pack, pr: { ...pack.pr, head: { sha: 'f'.repeat(40) } } }),
    ).toThrow(/stale or mismatched/);
  });
  it('requires reviewed context, full evidence accounting, and behavior descriptions', () => {
    const pack = authoredDemo(),
      flow = pack.flows[0];
    if (!flow) throw new Error('Fixture flow missing');
    expect(() =>
      validatePack({ ...pack, flows: [{ ...flow, title: 'Trace Args' }, ...pack.flows.slice(1)] }),
    ).toThrow(/behavior/);
    expect(() =>
      validatePack({ ...pack, flows: [{ ...flow, actor: '' }, ...pack.flows.slice(1)] }),
    ).toThrow(/actor/);
    expect(() => validatePack({ ...pack, flows: [flow] })).toThrow(/omits evidence/);
    expect(() =>
      validatePack({
        ...pack,
        authorship: { ...pack.authorship, contextReviewed: ['unavailable.ts'] },
      }),
    ).toThrow(/context/);
    const step = flow.steps[0];
    expect(() =>
      validatePack({
        ...pack,
        flows: [
          {
            ...flow,
            steps: [
              { ...step, context: { path: Object.keys(pack.sources)[0], start: 1, end: 999999 } },
              ...flow.steps.slice(1),
            ],
          },
          ...pack.flows.slice(1),
        ],
      }),
    ).toThrow(/range/);
  });
  it('preserves authored explanations, notes, code, flags and checkpoints on reopen', () => {
    const pack = authoredDemo(),
      flow = pack.flows[0];
    if (!flow) throw new Error('Fixture flow missing');
    const step = flow.steps[0];
    let session = inspectStep(startReview(pack), step, new Set(step.blockIds), 'flag');
    session = saveNote(session, step, 'Check request ownership before locking');
    persistReview(session);
    const stored = loadReview();
    if (stored.kind !== 'ready') throw new Error('Authored pack did not reopen');
    const roundtrip = decodeSession(JSON.parse(JSON.stringify(stored.session)));
    expect(roundtrip.pack.flows).toEqual(pack.flows);
    expect(roundtrip.pack.blocks).toEqual(pack.blocks);
    expect(roundtrip.state.notes[step.id]).toBe('Check request ownership before locking');
    expect(roundtrip.state.stepStatus[step.id]).toBe('flag');
    expect(roundtrip.state.position).toEqual(session.state.position);
    expect(reviewView(roundtrip, new Set()).kind).toBe('review');
  });
});
describe('source snapshot verification', () => {
  function fixture(patch: string, base: string, head: string) {
    const pack: ReviewPack = buildPack(
      { title: 'Change', base: { sha: '0'.repeat(40) }, head: { sha: '1'.repeat(40) } },
      [{ filename: 'service.js', patch, additions: 1, deletions: 1 }],
    );
    return {
      pack,
      snapshot: {
        base: '0'.repeat(40),
        head: '1'.repeat(40),
        changedPaths: ['service.js'],
        files: { 'service.js': { base, head } },
        context: {},
      },
    };
  }
  it('checks full pinned source and rejects omitted hunks or wrong commits', () => {
    const { pack, snapshot } = fixture(
      '@@ -1,2 +1,2 @@\n-one\n+two\n stable',
      'one\nstable\n',
      'two\nstable\n',
    );
    expect(() => verifySourceSnapshot(pack, snapshot)).not.toThrow();
    expect(() => verifySourceSnapshot(pack, { ...snapshot, head: '2'.repeat(40) })).toThrow(
      /commits/,
    );
    expect(() =>
      verifySourceSnapshot(pack, { ...snapshot, changedPaths: ['service.js', 'omitted.js'] }),
    ).toThrow(/omits/);
    expect(() =>
      verifySourceSnapshot(pack, {
        ...snapshot,
        files: { 'service.js': { base: 'one\nstable\n', head: 'two\nhidden change\n' } },
      }),
    ).toThrow(/incomplete/);
  });
  it('handles pure insertions, deletions, and stale cached context', () => {
    const insertion = fixture('@@ -1,0 +2 @@\n+two', 'one\n', 'one\ntwo\n');
    expect(() => verifySourceSnapshot(insertion.pack, insertion.snapshot)).not.toThrow();
    const deletion = fixture('@@ -2 +1,0 @@\n-two', 'one\ntwo\n', 'one\n');
    expect(() => verifySourceSnapshot(deletion.pack, deletion.snapshot)).not.toThrow();
    const pack = { ...insertion.pack, sources: { 'AGENTS.md': 'review rules' } };
    expect(() =>
      verifySourceSnapshot(pack, { ...insertion.snapshot, context: { 'AGENTS.md': 'stale' } }),
    ).toThrow(/context differs/);
  });
});
