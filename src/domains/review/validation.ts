import { parseEvidence, hash } from './evidence';
import { MAX_AUTHORED_STEPS, packSchema, type ReviewPack } from './schema';

export function hasReviewPlan(pack: ReviewPack): boolean {
  return pack.mapping === 'authored' || pack.mapping === 'curated';
}
export function sourceFingerprint(pack: Pick<ReviewPack, 'pr' | 'files' | 'sources'>): string {
  return hash(
    JSON.stringify([
      pack.pr.head?.sha ?? null,
      pack.pr.base?.sha ?? null,
      pack.files,
      Object.entries(pack.sources).sort(([a], [b]) => a.localeCompare(b)),
    ]),
  );
}
export function validatePack(input: unknown): ReviewPack {
  const pack = packSchema.parse(input);
  const blocks = new Map(pack.blocks.map((block) => [block.id, block])),
    flows = new Set(pack.flows.map((flow) => flow.id)),
    steps = new Set(pack.flows.flatMap((flow) => flow.steps.map((step) => step.id)));
  if (
    blocks.size !== pack.blocks.length ||
    flows.size !== pack.flows.length ||
    steps.size !== pack.flows.flatMap((flow) => flow.steps).length
  )
    throw new Error('Review contains duplicate IDs.');
  const expected = parseEvidence(pack.files);
  if (
    expected.length !== pack.blocks.length ||
    expected.some((block) => {
      const saved = blocks.get(block.id);
      return (
        !saved ||
        saved.path !== block.path ||
        saved.code !== block.code ||
        saved.start !== block.start ||
        saved.end !== block.end ||
        saved.missing !== block.missing
      );
    })
  )
    throw new Error('Evidence does not match the supplied patches or exact source ranges.');
  const assigned = new Set<string>();
  for (const flow of pack.flows)
    for (const step of flow.steps) {
      if (step.blockIds.some((id) => !blocks.has(id)))
        throw new Error('Review references missing evidence.');
      step.blockIds.forEach((id) => assigned.add(id));
      if (step.context && pack.mapping === 'authored') {
        const source = pack.sources[step.context.path];
        if (source === undefined)
          throw new Error('Authored steps must include their pinned source context.');
        if (source !== undefined && step.context.end > source.split('\n').length)
          throw new Error('Source context range is outside the included snapshot.');
      }
    }
  if (pack.mapping === 'evidence' && pack.flows.length)
    throw new Error('Evidence intake cannot contain review flows.');
  if (hasReviewPlan(pack) && !pack.flows.length)
    throw new Error('An authored review needs at least one behavior flow.');
  const unassigned = new Set<string>();
  for (const item of pack.unmapped) {
    if (!blocks.has(item.blockId) || assigned.has(item.blockId) || unassigned.has(item.blockId))
      throw new Error('Invalid or duplicate unmapped evidence disposition.');
    unassigned.add(item.blockId);
  }
  if (
    hasReviewPlan(pack) &&
    pack.blocks.some((block) => !assigned.has(block.id) && !unassigned.has(block.id))
  )
    throw new Error(
      'Review omits evidence. Assign every block or list it in unmapped with a reason.',
    );
  if (pack.mapping === 'authored') {
    const author = pack.authorship;
    if (!author || !pack.pr.head || !pack.pr.base)
      throw new Error('Authored reviews require authorship and pinned base/head commits.');
    if (author.sourceFingerprint !== sourceFingerprint(pack))
      throw new Error('Authored review source fingerprint is stale or mismatched.');
    if (author.contextReviewed.some((path) => pack.sources[path] === undefined))
      throw new Error('Reviewed project context must be included in sources.');
    if (steps.size > MAX_AUTHORED_STEPS)
      throw new Error(
        `Group related evidence into fewer than ${MAX_AUTHORED_STEPS + 1} behavior steps.`,
      );
    for (const flow of pack.flows) {
      if (
        !flow.actor.trim() ||
        !flow.trigger.trim() ||
        !flow.authorization.trim() ||
        !flow.summary.trim() ||
        /^(?:Trace\s+)?(?:Args|constructor|reserved)$/i.test(flow.title)
      )
        throw new Error(
          'Authored flows must describe a behavior, actor, trigger, authorization, and summary.',
        );
      for (const step of flow.steps)
        if (![step.summary, step.input, step.output, step.question].every((value) => value.trim()))
          throw new Error(
            'Authored steps require explanations, inputs, outputs, and review questions.',
          );
    }
  }
  return pack;
}
