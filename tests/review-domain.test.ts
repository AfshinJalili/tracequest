import { describe, expect, it } from 'vitest';
import demo from '../public/demo.json';
import raw from './fixtures/demo-source.json';
import {
  blockIdSchema,
  buildPack,
  decodeSession,
  importDiff,
  inspectStep,
  parseEvidence,
  parseUnifiedDiff,
  remapReview,
  reviewReport,
  reviewView,
  saveNote,
  selectStep,
  startReview,
  validateMappedFlows,
  validatePack,
} from '@/domains/review';
const pack = validatePack(demo);
describe('review domain', () => {
  it('preserves every line and stable evidence ID from the real Vendure PR', () => {
    const generated = parseEvidence(pack.files);
    expect(generated).toHaveLength(14);
    for (const file of raw.files)
      expect(
        generated
          .filter((block) => block.path === file.filename)
          .map((block) => block.code)
          .join('\n'),
      ).toBe(file.patch);
    expect(generated.map((block) => block.id)).toEqual(pack.blocks.map((block) => block.id));
    expect(pack.flows).toHaveLength(4);
    expect(pack.flows.flatMap((flow) => flow.steps)).toHaveLength(15);
  });
  it('requires all evidence to be opened before inspection', () => {
    const session = startReview(pack),
      step = pack.flows[0].steps[0];
    expect(() => inspectStep(session, step, new Set(), 'done')).toThrow(/Open every/);
    const next = inspectStep(session, step, new Set(step.blockIds), 'done');
    expect(reviewView(next, new Set()).coverage.inspected).toBe(3);
    expect(session.state.status).toEqual({});
  });
  it('counts shared evidence once and retains another step’s flag when one is resolved', () => {
    const first = pack.flows[0].steps.find((step) => step.id === 'fresh-owner'),
      second = pack.flows[0].steps.find((step) => step.id === 'fresh-reread');
    if (!first || !second) throw new Error('Fixture steps missing.');
    let session = startReview(pack);
    const opened = new Set(first.blockIds);
    session = inspectStep(session, first, opened, 'flag');
    session = inspectStep(session, second, opened, 'flag');
    session = inspectStep(session, first, opened, 'done');
    expect(reviewView(session, opened).coverage.flags).toBe(1);
    expect(reviewView(session, opened).coverage.inspected).toBe(1);
    session = inspectStep(session, second, opened, 'done');
    expect(reviewView(session, opened).coverage.flags).toBe(0);
  });
  it('rejects made-up AI references and retains omitted evidence', () => {
    expect(() =>
      validateMappedFlows(
        { flows: [{ title: 'Bad', steps: [{ blockIds: ['invented'] }] }] },
        pack.blocks,
      ),
    ).toThrow(/missing evidence/);
    const flows = validateMappedFlows(
      { flows: [{ title: 'Partial', steps: [{ blockIds: [pack.blocks[0].id] }] }] },
      pack.blocks,
    );
    expect(flows).toHaveLength(2);
    expect(flows[1]?.title).toBe('Unmapped evidence');
    expect(flows[1]?.steps).toHaveLength(13);
  });
  it('carries notes and flags to a remapped flow without marking new steps reviewed', () => {
    const step = pack.flows[0].steps[0],
      opened = new Set(step.blockIds);
    let session = inspectStep(startReview(pack), step, opened, 'flag');
    session = saveNote(session, step, 'Check transaction context');
    const mapped = {
      ...pack,
      mapping: 'ai',
      flows: validateMappedFlows(
        { flows: [{ title: 'Mapped', steps: [{ blockIds: step.blockIds }] }] },
        pack.blocks,
      ),
    } satisfies typeof pack;
    const next = remapReview(session, mapped),
      view = reviewView(next, opened);
    expect(view.notes[0]?.text).toContain('Check transaction context');
    expect(view.step.status).toBe('flag');
    expect(view.coverage.inspected).toBe(3);
  });
  it('keeps missing patches visible and non-reviewable', () => {
    const missing = buildPack({ title: 'Binary' }, [
        { filename: 'image.png', additions: 0, deletions: 0 },
      ]),
      session = startReview(missing);
    expect(reviewView(session, new Set()).coverage.missing).toBe(1);
    expect(() =>
      inspectStep(session, missing.flows[0].steps[0], new Set([missing.blocks[0].id]), 'done'),
    ).toThrow();
  });
  it('imports deletions without losing removed lines', () => {
    const files = parseUnifiedDiff(
      'diff --git a/old.js b/old.js\ndeleted file mode 100644\n--- a/old.js\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-one\n-two',
    );
    expect(files[0]?.deletions).toBe(2);
    expect(parseEvidence(files)[0]?.code).toContain('-two');
    expect(() => importDiff('invalid')).toThrow(/No unified diff/);
  });
  it('finds cross-file candidate links without calling them verified', () => {
    const candidate = buildPack({ title: 'Order' }, [
      {
        filename: 'order.controller.ts',
        patch: '@@ -0,0 +1,3 @@\n+async createOrder() {\n+ return service.reserveStock();\n+}',
        additions: 3,
        deletions: 0,
      },
      {
        filename: 'stock.service.ts',
        patch: '@@ -0,0 +1,3 @@\n+async reserveStock() {\n+ return repository.save();\n+}',
        additions: 3,
        deletions: 0,
      },
    ]);
    expect(candidate.flows[0].steps).toHaveLength(2);
    expect(candidate.mapping).toBe('candidate');
  });
  it('prunes stale stored IDs and rejects an invalid selection command', () => {
    const session = startReview(pack);
    const restored = decodeSession({
      ...session,
      state: { ...session.state, status: { stale: 'done' }, notes: { stale: 'old' } },
    });
    expect(restored.state.status).toEqual({});
    expect(restored.state.notes).toEqual({});
    expect(() =>
      selectStep(session, {
        flow: pack.flows[0].id,
        step: pack.flows[1]?.steps[0].id ?? pack.flows[0].steps[0].id,
      }),
    ).toThrow(/not part/);
  });
  it('exports a review record, never an approval', () => {
    let session = startReview(pack);
    const step = pack.flows[0].steps[0];
    session = inspectStep(session, step, new Set(step.blockIds), 'flag');
    session = saveNote(session, step, 'Check the lock');
    const text = reviewReport(session);
    expect(text).toContain('3/14');
    expect(text).toContain('not an approval');
    expect(text).toContain('Check the lock');
    expect(text).toContain('FLAG');
  });
  it('does not accept a forged block ID as opened evidence', () => {
    const step = pack.flows[0].steps[0];
    expect(() =>
      inspectStep(startReview(pack), step, new Set([blockIdSchema.parse('forged')]), 'done'),
    ).toThrow();
  });
});
