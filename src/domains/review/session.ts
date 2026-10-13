import { evidenceForStep } from './evidence';
import { hasReviewPlan } from './validation';
import { MAX_NOTE_CHARACTERS } from './schema';
import {
  type BlockId,
  type Position,
  type ReviewPack,
  type ReviewSession,
  type ReviewState,
  type ReviewStep,
  type StepId,
} from './schema';

export function startReview(pack: ReviewPack): ReviewSession {
  const first = hasReviewPlan(pack) ? pack.flows[0] : undefined;
  return {
    pack,
    state: {
      status: {},
      stepStatus: {},
      notes: {},
      position: first ? { flow: first.id, step: first.steps[0].id } : null,
      updated: 0,
    },
  };
}
export function selectStep(session: ReviewSession, position: Position): ReviewSession {
  const flow = session.pack.flows.find((flow) => flow.id === position.flow);
  if (!flow?.steps.some((step) => step.id === position.step))
    throw new Error('That step is not part of this review.');
  return { ...session, state: { ...session.state, position, updated: session.state.updated } };
}
export function saveNote(session: ReviewSession, step: ReviewStep, text: string): ReviewSession {
  return {
    ...session,
    state: {
      ...session.state,
      notes: { ...session.state.notes, [step.id]: text.slice(0, MAX_NOTE_CHARACTERS) },
      updated: session.state.updated,
    },
  };
}
export function inspectStep(
  session: ReviewSession,
  step: ReviewStep,
  opened: ReadonlySet<BlockId>,
  status: 'done' | 'flag',
): ReviewSession {
  if (!hasReviewPlan(session.pack))
    throw new Error('Import an authored review before inspecting steps.');
  const evidence = evidenceForStep(session.pack.blocks, step);
  if (evidence.some((block) => block.missing || !opened.has(block.id)))
    throw new Error('Open every code block before marking this step reviewed.');
  const state: ReviewState = {
    ...session.state,
    status: { ...session.state.status },
    stepStatus: { ...session.state.stepStatus, [step.id]: status },
    updated: session.state.updated,
  };
  for (const id of step.blockIds)
    state.status[id] =
      status === 'flag'
        ? 'flag'
        : state.status[id] === 'flag' && session.state.stepStatus[step.id] !== 'flag'
          ? 'flag'
          : 'done';
  for (const id of step.blockIds)
    if (
      session.pack.flows.some((flow) =>
        flow.steps.some(
          (candidate) =>
            candidate.blockIds.includes(id) && state.stepStatus[candidate.id] === 'flag',
        ),
      )
    )
      state.status[id] = 'flag';
  return { ...session, state };
}
export function remapReview(session: ReviewSession, pack: ReviewPack): ReviewSession {
  if (
    !hasReviewPlan(pack) ||
    JSON.stringify(session.pack.files) !== JSON.stringify(pack.files) ||
    (session.pack.pr.head && session.pack.pr.head.sha !== pack.pr.head?.sha)
  )
    throw new Error('The authored review must match the current evidence and pinned commit.');
  const previousSteps = new Map(
    session.pack.flows.flatMap((flow) => flow.steps).map((step) => [step.id, step]),
  );
  const previousStories = new Map(
    session.pack.flows.flatMap((flow) =>
      flow.steps.map((step) => [step.id, flow.story] satisfies [StepId, typeof flow.story]),
    ),
  );
  const preserved = new Set<StepId>();
  const prior = [...previousSteps.values()].filter(
      (step) => session.state.notes[step.id] || session.state.stepStatus[step.id] === 'flag',
    ),
    notes: ReviewState['notes'] = {},
    stepStatus: ReviewState['stepStatus'] = {};
  for (const flow of pack.flows)
    for (const step of flow.steps) {
      const previous = previousSteps.get(step.id);
      if (
        previous &&
        JSON.stringify(previous) === JSON.stringify(step) &&
        JSON.stringify(previousStories.get(step.id)) === JSON.stringify(flow.story)
      ) {
        preserved.add(step.id);
        const note = session.state.notes[step.id],
          status = session.state.stepStatus[step.id];
        if (note !== undefined) notes[step.id] = note;
        if (status) stepStatus[step.id] = status;
        continue;
      }
      const matches = prior.filter((previous) =>
          previous.blockIds.some((id) => step.blockIds.includes(id)),
        ),
        texts = matches.flatMap((previous) => {
          const note = session.state.notes[previous.id];
          return note ? ['[From ' + previous.title + '] ' + note] : [];
        });
      if (texts.length) notes[step.id] = texts.join('\n\n').slice(0, MAX_NOTE_CHARACTERS);
      if (matches.some((previous) => session.state.stepStatus[previous.id] === 'flag'))
        stepStatus[step.id] = 'flag';
    }
  const first = hasReviewPlan(pack) ? pack.flows[0] : undefined;
  const checkpoint = session.state.position;
  const checkpointFlow = pack.flows.find((flow) =>
    flow.steps.some((step) => step.id === checkpoint?.step && preserved.has(step.id)),
  );
  return {
    pack,
    state: {
      ...session.state,
      notes,
      stepStatus,
      position:
        checkpoint && checkpointFlow
          ? { flow: checkpointFlow.id, step: checkpoint.step }
          : first
            ? { flow: first.id, step: first.steps[0].id }
            : null,
      updated: session.state.updated,
    },
  };
}
