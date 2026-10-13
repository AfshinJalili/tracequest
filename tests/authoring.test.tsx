import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  agentReviewPrompt,
  decodeSession,
  inspectStep,
  remapReview,
  reviewPackJsonSchema,
  reviewView,
  startReview,
  saveNote,
  stepContext,
  validatePack,
} from '@/domains/review';
import {
  FlowStory,
  StepRationale,
  StoryExamples,
} from '@/features/review/components/story-details';
import { storyPack } from './story-fixture';
import { ReviewPage } from '@/features/review/review-page';
import { TooltipProvider } from '@/components/ui/tooltip';
import { persistReview } from '@/persistence/review-storage';

describe('story authoring', () => {
  it('requires another inspection after a flow example changes while carrying the existing note', () => {
    const pack = storyPack(),
      flow = pack.flows[0];
    if (!flow?.story) throw new Error('Story missing');
    const step = flow.steps[0];
    const session = saveNote(
      inspectStep(startReview(pack), step, new Set(step.blockIds), 'done'),
      step,
      'Check numeric input',
    );
    expect(remapReview(session, pack).state.stepStatus[step.id]).toBe('done');
    const changed = validatePack({
      ...pack,
      flows: [
        {
          ...flow,
          story: {
            ...flow.story,
            examples: flow.story.examples.map((example) => ({
              ...example,
              title: example.title + ' with caller context',
            })),
          },
        },
      ],
    });
    const remapped = remapReview(session, changed);
    expect(remapped.state.stepStatus[step.id]).toBeUndefined();
    expect(remapped.state.notes[step.id]).toContain('Check numeric input');
  });
  it('preserves reasons, examples, provenance, and source references through export and restore', () => {
    const pack = storyPack();
    const restored = decodeSession(JSON.parse(JSON.stringify(startReview(pack))));
    expect(restored.pack).toEqual(pack);
    const flow = restored.pack.flows[0];
    if (!flow) throw new Error('Story missing');
    const prompt = stepContext(restored, flow.steps[0], 'Why reject zero?');
    expect(prompt).toContain(JSON.stringify('{"ownerId":"42","quantity":2}'));
    expect(prompt).toContain('"basis": "traced"');
    expect(prompt).toContain('PINNED CONTEXT api.mjs:2-5');
    expect(prompt).toContain('INVALID_QUANTITY');
    expect(agentReviewPrompt(pack)).toContain('Create discovery.md');
    expect(agentReviewPrompt(pack)).toContain('authorship.method="story-v1"');
  });
  it('requires new story reviews to contain flow examples and step reasons', () => {
    const pack = storyPack(),
      flow = pack.flows[0];
    if (!flow) throw new Error('Story missing');
    expect(() => validatePack({ ...pack, flows: [{ ...flow, story: undefined }] })).toThrow(
      /flow examples/,
    );
    expect(() =>
      validatePack({
        ...pack,
        flows: [{ ...flow, steps: [{ ...flow.steps[0], rationale: undefined }] }],
      }),
    ).toThrow(/rationale/);
    expect(() =>
      validatePack({ ...pack, flows: [{ ...flow, story: { ...flow.story, examples: [] } }] }),
    ).toThrow();
    expect(() =>
      validatePack({
        ...pack,
        authorship: { ...pack.authorship, method: undefined },
        flows: [
          {
            ...flow,
            story: undefined,
            steps: [{ ...flow.steps[0], rationale: undefined, examples: undefined }],
          },
        ],
      }),
    ).not.toThrow();
  });
  it('rejects unbacked ranges and references the agent did not list as reviewed', () => {
    const pack = storyPack(),
      flow = pack.flows[0];
    if (!flow?.story) throw new Error('Story missing');
    const example = flow.story.examples[0];
    expect(() =>
      validatePack({
        ...pack,
        flows: [
          {
            ...flow,
            story: {
              ...flow.story,
              examples: [{ ...example, references: [{ path: 'absent.mjs', start: 1, end: 2 }] }],
            },
          },
        ],
      }),
    ).toThrow(/pinned source/);
    expect(() =>
      validatePack({
        ...pack,
        flows: [
          {
            ...flow,
            story: {
              ...flow.story,
              examples: [{ ...example, references: [{ path: 'service.mjs', start: 1, end: 900 }] }],
            },
          },
        ],
      }),
    ).toThrow(/outside/);
    expect(() =>
      validatePack({
        ...pack,
        authorship: { ...pack.authorship, contextReviewed: ['service.mjs'] },
      }),
    ).toThrow(/reviewed context/);
  });
  it('requires an execution record when an example claims it was run', () => {
    const pack = storyPack(),
      flow = pack.flows[0];
    if (!flow?.story) throw new Error('Story missing');
    const example = flow.story.examples[0];
    expect(() =>
      validatePack({
        ...pack,
        flows: [
          { ...flow, story: { ...flow.story, examples: [{ ...example, basis: 'executed' }] } },
        ],
      }),
    ).toThrow();
    expect(reviewPackJsonSchema()).toMatchObject({
      type: 'object',
      properties: { flows: { type: 'array' } },
    });
  });
  it('keeps the overview, example values, and reason expandable in the review UI', async () => {
    const view = reviewView(startReview(storyPack()), new Set());
    if (view.kind !== 'review' || !view.step.rationale || !view.step.examples)
      throw new Error('Story view missing');
    const user = userEvent.setup();
    render(
      <>
        <FlowStory flow={view.flow} />
        <StepRationale rationale={view.step.rationale} />
        <StoryExamples examples={view.step.examples} />
      </>,
    );
    expect(
      screen.getByText(
        'The guard prevents a zero or negative quantity from reaching the return. It does not validate the numeric type.',
      ),
    ).not.toBeVisible();
    await user.click(screen.getByText('Why this step'));
    expect(
      screen.getByText(
        'The guard prevents a zero or negative quantity from reaching the return. It does not validate the numeric type.',
      ),
    ).toBeVisible();
    const example = screen.getAllByText('Reserve two units').at(-1);
    if (!example) throw new Error('Example missing');
    await user.click(example);
    expect(
      screen
        .getAllByText('{"ownerId":"42","quantity":2}')
        .some((node) => node.closest('details')?.open),
    ).toBe(true);
    expect(screen.getAllByText('Traced from source').length).toBeGreaterThan(0);
    expect(screen.getAllByText('api.mjs:2-5').length).toBeGreaterThan(0);
  });
  it('shows an imported story in the full review page with its input/output examples', async () => {
    persistReview(startReview(storyPack()));
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ReviewPage />
      </TooltipProvider>,
    );
    await screen.findByRole('heading', {
      name: 'Reserve a positive quantity for the current owner',
    });
    await user.click(screen.getByText('Flow overview'));
    expect(screen.getByText('Current user, owner ID, and requested quantity')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Summary' }));
    await user.click(screen.getByText('Why this step'));
    expect(
      screen.getByText(
        'The guard prevents a zero or negative quantity from reaching the return. It does not validate the numeric type.',
      ),
    ).toBeVisible();
    await user.click(screen.getByText('Reject zero units'));
    expect(screen.getByText('INVALID_QUANTITY', { selector: 'pre' })).toBeVisible();
  });
});
