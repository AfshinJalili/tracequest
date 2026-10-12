import { packSchema, type ReviewPack } from './schema';

export function validatePack(input: unknown): ReviewPack {
  const pack = packSchema.parse(input);
  const blocks = new Set(pack.blocks.map((block) => block.id)),
    flows = new Set(pack.flows.map((flow) => flow.id)),
    steps = new Set(pack.flows.flatMap((flow) => flow.steps.map((step) => step.id)));
  if (
    blocks.size !== pack.blocks.length ||
    flows.size !== pack.flows.length ||
    steps.size !== pack.flows.flatMap((flow) => flow.steps).length
  )
    throw new Error('Review contains duplicate IDs.');
  for (const flow of pack.flows)
    for (const step of flow.steps)
      if (step.blockIds.some((id) => !blocks.has(id)))
        throw new Error('Review references missing evidence.');
  return pack;
}
