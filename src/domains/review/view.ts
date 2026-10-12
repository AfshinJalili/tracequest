import { codeRows, evidenceForStep, isModelDefinition } from './evidence';
import { hasReviewPlan } from './validation';
import { type BlockId, type Position, type ReviewSession } from './schema';
function inspectionState(value: 'done' | 'flag' | undefined): 'done' | 'flag' | 'pending' {
  return value ?? 'pending';
}
export function reviewView(session: ReviewSession, opened: ReadonlySet<BlockId>) {
  const { pack, state } = session;
  const plan = hasReviewPlan(pack);
  const assigned = new Set(
    plan ? pack.flows.flatMap((flow) => flow.steps.flatMap((step) => step.blockIds)) : [],
  );
  const reasons = new Map(pack.unmapped.map((item) => [item.blockId, item.reason]));
  const blocks = pack.blocks.map((block) => ({
    ...block,
    status: inspectionState(state.status[block.id]),
    rows: codeRows(block.code, block.start),
    mapped: assigned.has(block.id),
    unmappedReason: reasons.get(block.id) ?? null,
  }));
  const inspected = blocks.filter((block) => block.status !== 'pending').length,
    flags = blocks.filter((block) => block.status === 'flag').length,
    missing = blocks.filter((block) => block.missing).length;
  const flowViews = (plan ? pack.flows : []).map((flow) => ({
    ...flow,
    stepCount: flow.steps.length,
    inspected: flow.steps.filter((step) => state.stepStatus[step.id]).length,
    steps: flow.steps.map((step, index) => ({
      ...step,
      number: index + 1,
      status: inspectionState(state.stepStatus[step.id]),
      selected: state.position?.step === step.id,
      position: { flow: flow.id, step: step.id },
    })),
    selected: state.position?.flow === flow.id,
    startPosition: { flow: flow.id, step: flow.steps[0].id },
  }));
  const allSteps = flowViews.flatMap((flow) => flow.steps);
  const stepsInspected = allSteps.filter((step) => state.stepStatus[step.id]).length;
  const notes = flowViews.flatMap((flow) =>
    flow.steps.flatMap((step) => {
      const text = state.notes[step.id];
      return text || step.status === 'flag'
        ? [
            {
              stepId: step.id,
              flowTitle: flow.title,
              title: step.title,
              text: text ?? 'Flagged for another look.',
              flagged: step.status === 'flag',
              position: step.position,
            },
          ]
        : [];
    }),
  );
  const common = {
    pack,
    blocks,
    flows: flowViews,
    notes,
    primaryLabel: plan ? 'Review' : 'Evidence',
    repo: pack.pr.html_url
      ? new URL(pack.pr.html_url).pathname.split('/').slice(1, 3).join(' / ')
      : 'Local review',
    sourceLabel: pack.pr.number ? 'PR #' + pack.pr.number : 'Local diff',
    mappingLabel:
      pack.mapping === 'curated'
        ? 'Demo'
        : pack.mapping === 'authored'
          ? 'Agent authored'
          : pack.mapping === 'evidence'
            ? 'Evidence only'
            : 'Needs curation',
    contextMissing:
      pack.authorship?.missingContext ??
      (pack.mapping === 'curated'
        ? ['Legacy curated content has no full-project verification record.']
        : ['Project docs, unchanged callers, models, and tests have not been supplied.']),
    unmappedFiles: pack.files
      .map((file) => ({
        path: file.filename,
        blocks: blocks.filter((block) => block.path === file.filename && !block.mapped),
      }))
      .filter((file) => file.blocks.length),
    evidenceFiles: pack.files.map((file) => ({
      path: file.filename,
      blocks: blocks.filter((block) => block.path === file.filename),
    })),
    models: Object.entries(pack.sources)
      .filter(([path]) => isModelDefinition(path))
      .map(([path, source]) => ({
        path,
        name: path.split('/').at(-1) ?? path,
        rows: codeRows(source, 1, 'source'),
        url: sourceUrl(session, path),
      })),
    coverage: {
      total: blocks.length,
      inspected,
      flags,
      missing,
      unmapped: blocks.filter((block) => !block.mapped).length,
      percent: Math.round((inspected / blocks.length) * 100),
      pending: blocks.length - inspected,
    },
    steps: {
      total: allSteps.length,
      inspected: stepsInspected,
      percent: allSteps.length ? Math.round((stepsInspected / allSteps.length) * 100) : 0,
    },
    changeStats: {
      files: pack.files.length,
      additions: pack.pr.additions ?? pack.files.reduce((sum, file) => sum + file.additions, 0),
      deletions: pack.pr.deletions ?? pack.files.reduce((sum, file) => sum + file.deletions, 0),
    },
  };
  if (!plan) {
    const kind: 'evidence' = 'evidence';
    return { ...common, kind };
  }
  const flow = flowViews.find((flow) => flow.id === state.position?.flow) ?? flowViews[0];
  if (!flow) throw new Error('Review has no flows.');
  const step = flow.steps.find((step) => step.id === state.position?.step) ?? flow.steps[0];
  if (!step) throw new Error('Flow has no steps.');
  const evidence = evidenceForStep(pack.blocks, step);
  const positions: Position[] = pack.flows.flatMap((flow) =>
    flow.steps.map((step) => ({ flow: flow.id, step: step.id })),
  );
  const selected = positions.findIndex((position) => position.step === step.id);
  const kind: 'review' = 'review';
  return {
    ...common,
    kind,
    flow,
    step,
    evidence: blocks.filter((block) => step.blockIds.includes(block.id)),
    entities: pack.entities.filter((entity) =>
      [step.summary, step.input, step.output]
        .join(' ')
        .toLowerCase()
        .includes(entity.toLowerCase()),
    ),
    note: state.notes[step.id] ?? '',
    canInspect: evidence.every((block) => !block.missing && opened.has(block.id)),
    previous: positions[selected - 1] ?? null,
    next: positions[selected + 1] ?? null,
    flowComplete: flow.inspected === flow.stepCount,
  };
}
export type ReviewView = ReturnType<typeof reviewView>;
export type AuthoredReviewView = Extract<ReviewView, { kind: 'review' }>;
export function positionForBlock(session: ReviewSession, id: BlockId): Position | null {
  if (!hasReviewPlan(session.pack)) return null;
  for (const flow of session.pack.flows) {
    const step = flow.steps.find((step) => step.blockIds.includes(id));
    if (step) return { flow: flow.id, step: step.id };
  }
  return null;
}
export function sourceUrl(session: ReviewSession, path: string, line = 1): string | null {
  const url = session.pack.pr.html_url,
    sha = session.pack.pr.head?.sha;
  if (!url || !sha) return null;
  const [owner, repo] = new URL(url).pathname.split('/').slice(1, 3);
  return `https://github.com/${owner}/${repo}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}#L${line}`;
}
