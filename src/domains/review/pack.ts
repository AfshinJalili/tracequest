import {
  sessionSchema,
  stateSchema,
  type ChangedFile,
  type PullRequest,
  type ReviewPack,
  type ReviewSession,
} from './schema';
import { hash, parseEvidence, parseUnifiedDiff } from './evidence';
import { validatePack } from './validation';

export function buildPack(pr: PullRequest, files: ChangedFile[]): ReviewPack {
  const blocks = parseEvidence(files);
  return validatePack({
    version: 1,
    id: hash((pr.html_url ?? pr.title) + JSON.stringify(files)),
    pr,
    files,
    blocks,
    flows: [],
    mapping: 'evidence',
  });
}
export function importDiff(text: string, title = 'Local backend change'): ReviewPack {
  const files = parseUnifiedDiff(text);
  return buildPack(
    {
      title,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
    },
    files,
  );
}
export function decodeSession(input: unknown): ReviewSession {
  const session = sessionSchema.parse(input),
    pack = validatePack(session.pack);
  const validBlocks = new Set<string>(pack.blocks.map((block) => block.id)),
    validSteps = new Set<string>(pack.flows.flatMap((flow) => flow.steps.map((step) => step.id)));
  const first = pack.flows[0],
    positionFlow = pack.flows.find((flow) => flow.id === session.state.position?.flow),
    positionStep = positionFlow?.steps.find((step) => step.id === session.state.position?.step);
  const state = stateSchema.parse({
    ...session.state,
    status: Object.fromEntries(
      Object.entries(session.state.status).filter(([id]) => validBlocks.has(id)),
    ),
    stepStatus: Object.fromEntries(
      Object.entries(session.state.stepStatus).filter(([id]) => validSteps.has(id)),
    ),
    notes: Object.fromEntries(
      Object.entries(session.state.notes).filter(([id]) => validSteps.has(id)),
    ),
    position:
      positionFlow && positionStep
        ? { flow: positionFlow.id, step: positionStep.id }
        : first
          ? { flow: first.id, step: first.steps[0].id }
          : null,
  });
  return { pack, state };
}
