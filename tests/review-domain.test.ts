import { describe, expect, it } from 'vitest';
import demo from '../public/demo.json';
import raw from './fixtures/demo-source.json';
import { authoredDemo } from './review-fixture';
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
  validatePack,
} from '@/domains/review';
const pack = validatePack(demo);
const firstFlow = pack.flows[0];
if (!firstFlow) throw new Error('Demo flow missing.');
describe('review domain', () => {
  it('requires a new inspection when the selected step explanation changes', () => {
    const authored = authoredDemo(),
      flow = authored.flows[0];
    if (!flow) throw new Error('Fixture missing');
    const step = flow.steps[0];
    const session = inspectStep(startReview(authored), step, new Set(step.blockIds), 'done');
    const revised = validatePack({
      ...authored,
      flows: [
        {
          ...flow,
          steps: [{ ...step, summary: 'Revised behavior explanation' }, ...flow.steps.slice(1)],
        },
        ...authored.flows.slice(1),
      ],
    });
    const next = remapReview(session, revised);
    expect(next.state.stepStatus[step.id]).toBeUndefined();
    expect(next.state.position?.step).toBe(step.id);
  });
  it('preserves unchanged progress and notes when an authored plan is reimported', () => {
    const authored = authoredDemo(),
      flow = authored.flows[0];
    if (!flow) throw new Error('Fixture flow missing');
    const step = flow.steps[0],
      next = flow.steps[1];
    if (!next) throw new Error('Fixture checkpoint missing');
    let session = inspectStep(startReview(authored), step, new Set(step.blockIds), 'done');
    session = saveNote(session, step, 'Check request ownership');
    session = selectStep(session, { flow: flow.id, step: next.id });
    const revised = validatePack({
      ...authored,
      authorship: { ...authored.authorship, verificationNotes: 'Additional test run' },
    });
    const restored = remapReview(remapReview(session, revised), revised);
    expect(restored.state.notes[step.id]).toBe('Check request ownership');
    expect(restored.state.stepStatus[step.id]).toBe('done');
    expect(restored.state.position).toEqual(session.state.position);
  });
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
      step = firstFlow.steps[0];
    expect(() => inspectStep(session, step, new Set(), 'done')).toThrow(/Open every/);
    const next = inspectStep(session, step, new Set(step.blockIds), 'done');
    expect(reviewView(next, new Set()).coverage.inspected).toBe(3);
    expect(session.state.status).toEqual({});
  });
  it('counts shared evidence once and retains another step’s flag when one is resolved', () => {
    const first = firstFlow.steps.find((step) => step.id === 'fresh-owner'),
      second = firstFlow.steps.find((step) => step.id === 'fresh-reread');
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
  it('rejects dangling references and requires explicit dispositions for omitted evidence', () => {
    const step = firstFlow.steps[0];
    const partial = { ...pack, flows: [{ ...firstFlow, steps: [step] }] };
    expect(() => validatePack(partial)).toThrow(/omits evidence/);
    const accounted = {
      ...partial,
      unmapped: pack.blocks
        .filter((block) => !step.blockIds.includes(block.id))
        .map((block) => ({ blockId: block.id, reason: 'Requires a separate behavior review' })),
    };
    expect(validatePack(accounted).flows).toHaveLength(1);
    expect(() =>
      validatePack({
        ...accounted,
        flows: [{ ...firstFlow, steps: [{ ...step, blockIds: ['invented'] }] }],
      }),
    ).toThrow(/missing evidence/);
  });
  it('carries notes and flags to a remapped flow without marking new steps reviewed', () => {
    const step = firstFlow.steps[0],
      opened = new Set(step.blockIds);
    let session = inspectStep(startReview(pack), step, opened, 'flag');
    session = saveNote(session, step, 'Check transaction context');
    const mapped = validatePack({
      ...pack,
      flows: [{ ...firstFlow, steps: [{ ...step, id: 'remapped-step' }] }],
      unmapped: pack.blocks
        .filter((block) => !step.blockIds.includes(block.id))
        .map((block) => ({ blockId: block.id, reason: 'Not in this flow' })),
    });
    const next = remapReview(session, mapped),
      view = reviewView(next, opened);
    expect(view.notes[0]?.text).toContain('Check transaction context');
    if (view.kind !== 'review') throw new Error('Authored view missing.');
    expect(view.step.status).toBe('flag');
    expect(view.coverage.inspected).toBe(3);
  });
  it('keeps missing patches visible and non-reviewable', () => {
    const missing = buildPack({ title: 'Binary' }, [
        { filename: 'image.png', additions: 0, deletions: 0 },
      ]),
      session = startReview(missing);
    expect(reviewView(session, new Set()).coverage.missing).toBe(1);
    expect(reviewView(session, new Set()).kind).toBe('evidence');
  });
  it('imports deletions without losing removed lines', () => {
    const files = parseUnifiedDiff(
      'diff --git a/old.js b/old.js\ndeleted file mode 100644\n--- a/old.js\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-one\n-two',
    );
    expect(files[0]?.deletions).toBe(2);
    expect(parseEvidence(files)[0]?.code).toContain('-two');
    expect(() => importDiff('invalid')).toThrow(/No unified diff/);
  });
  it('ingests linked symbols as evidence without inventing review flows', () => {
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
    expect(candidate.flows).toHaveLength(0);
    expect(candidate.mapping).toBe('evidence');
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
        flow: firstFlow.id,
        step: pack.flows[1]?.steps[0].id ?? firstFlow.steps[0].id,
      }),
    ).toThrow(/not part/);
  });
  it('exports a review record, never an approval', () => {
    let session = startReview(pack);
    const step = firstFlow.steps[0];
    session = inspectStep(session, step, new Set(step.blockIds), 'flag');
    session = saveNote(session, step, 'Check the lock');
    const text = reviewReport(session);
    expect(text).toContain('3/14');
    expect(text).toContain('not an approval');
    expect(text).toContain('Check the lock');
    expect(text).toContain('FLAG');
  });
  it('does not accept a forged block ID as opened evidence', () => {
    const step = firstFlow.steps[0];
    expect(() =>
      inspectStep(startReview(pack), step, new Set([blockIdSchema.parse('forged')]), 'done'),
    ).toThrow();
  });
});
