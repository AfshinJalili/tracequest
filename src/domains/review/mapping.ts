import { z } from 'zod';
import {
  flowIdSchema,
  stepIdSchema,
  evidenceKindSchema,
  blockIdSchema,
  type EvidenceBlock,
  type ReviewFlow,
  type ReviewStep,
} from './schema';

const inferredStepSchema = z.object({
  title: z.string().max(160).default('Inspect change'),
  kind: evidenceKindSchema.default('Logic'),
  summary: z.string().max(5000).default(''),
  input: z.string().default('Verify input'),
  output: z.string().default('Verify output'),
  question: z.string().default('What can fail here?'),
  blockIds: z.tuple([blockIdSchema]).rest(blockIdSchema),
});
const inferredMapSchema = z.object({
  flows: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        summary: z.string().max(3000).default(''),
        steps: z.array(inferredStepSchema).min(1).max(150),
      }),
    )
    .min(1)
    .max(80),
});
function evidenceStep(block: EvidenceBlock, id: string, summary: string): ReviewStep {
  return {
    id: stepIdSchema.parse(id),
    title: block.title,
    kind: block.kind,
    summary,
    input: 'Caller / prior state. Verify in source.',
    output: 'Changed behavior. Verify in source.',
    question: 'What observable behavior changes, and what proves it?',
    blockIds: [block.id],
  };
}
export function candidateFlows(blocks: EvidenceBlock[]): ReviewFlow[] {
  const definitions = new Map<string, EvidenceBlock[]>(),
    symbols = new Map<string, string[]>(),
    used = new Set<string>(),
    flows: ReviewFlow[] = [];
  const clean = (block: EvidenceBlock) =>
    block.code
      .split('\n')
      .filter((line) => !line.startsWith('-'))
      .join('\n');
  for (const block of blocks) {
    const names = [
      ...clean(block).matchAll(
        /(?:async\s+|function\s+|def\s+|func\s+(?:\([^)]*\)\s*)?)([A-Za-z_$][\w$]{3,})\s*\(/g,
      ),
    ].flatMap((match) => (match[1] ? [match[1]] : []));
    symbols.set(block.id, names);
    for (const name of names) definitions.set(name, [...(definitions.get(name) ?? []), block]);
  }
  const roots = blocks.filter((block) => block.kind === 'Entry');
  if (!roots.length)
    roots.push(
      ...blocks.filter(
        (block) => block.kind === 'Logic' && (symbols.get(block.id)?.length ?? 0) > 0,
      ),
    );
  for (const root of roots.slice(0, 24)) {
    if (used.has(root.id)) continue;
    const route = [root],
      seen = new Set([root.id]);
    for (let position = 0; position < route.length && route.length < 7; position++) {
      const current = route[position];
      if (!current) break;
      for (const call of clean(current).matchAll(/(?:\.|\b)([A-Za-z_$][\w$]{3,})\s*\(/g)) {
        for (const dependency of definitions.get(call[1] ?? '') ?? []) {
          if (
            dependency.path !== current.path &&
            dependency.kind !== 'Proof' &&
            !seen.has(dependency.id)
          ) {
            route.push(dependency);
            seen.add(dependency.id);
            if (route.length >= 7) break;
          }
        }
        if (route.length >= 7) break;
      }
    }
    route.forEach((block) => used.add(block.id));
    const head = evidenceStep(
      root,
      'candidate-' + flows.length + '-' + root.id,
      'Start with this changed behavior. The real entry point may be outside the diff.',
    );
    const rest = route
      .slice(1)
      .map((block) =>
        evidenceStep(
          block,
          'candidate-' + flows.length + '-' + block.id,
          'A preceding block mentions a definition with this name. Verify that link in source.',
        ),
      );
    flows.push({
      id: flowIdSchema.parse('candidate-' + flows.length),
      title: 'Trace ' + root.title,
      subtitle: 'Symbol-linked candidate',
      summary:
        'Call and definition names match in this patch. Names may be ambiguous and unchanged callers are absent. Verify the route.',
      steps: [head, ...rest],
    });
  }
  for (const category of [
    { title: 'Supporting contracts and state', proof: false },
    { title: 'Regression evidence', proof: true },
  ]) {
    const remaining = blocks.filter(
        (block) => !used.has(block.id) && (block.kind === 'Proof') === category.proof,
      ),
      first = remaining[0];
    if (!first) continue;
    const id = 'candidate-' + flows.length;
    flows.push({
      id: flowIdSchema.parse(id),
      title: category.title,
      subtitle: 'Unlinked evidence',
      summary: 'These blocks have no reliable caller link in the patch.',
      steps: [
        evidenceStep(first, id + '-' + first.id, 'No inferred caller is available from the patch.'),
        ...remaining
          .slice(1)
          .map((block) =>
            evidenceStep(
              block,
              id + '-' + block.id,
              'No inferred caller is available from the patch.',
            ),
          ),
      ],
    });
  }
  const firstFlow = flows[0];
  if (!firstFlow) throw new Error('AI returned no flows.');
  return [firstFlow, ...flows.slice(1)];
}
export function validateMappedFlows(
  input: unknown,
  blocks: EvidenceBlock[],
): [ReviewFlow, ...ReviewFlow[]] {
  const value = inferredMapSchema.parse(input),
    known = new Set(blocks.map((block) => block.id));
  let stepCount = 0;
  const flows: ReviewFlow[] = value.flows.map((flow, index) => {
    const mapStep = (step: z.infer<typeof inferredStepSchema>, position: number): ReviewStep => {
      stepCount++;
      if (step.blockIds.some((id) => !known.has(id)))
        throw new Error('AI cited missing evidence. Current flows were kept.');
      return { ...step, id: stepIdSchema.parse(`ai-${index}-${position}`) };
    };
    const first = flow.steps[0];
    if (!first) throw new Error('Flow has no steps.');
    return {
      id: flowIdSchema.parse('ai-' + index),
      title: flow.title,
      subtitle: 'AI inferred',
      summary: flow.summary,
      steps: [
        mapStep(first, 0),
        ...flow.steps.slice(1).map((step, position) => mapStep(step, position + 1)),
      ],
    };
  });
  if (stepCount > 500) throw new Error('AI plan has too many steps.');
  const used = new Set(flows.flatMap((flow) => flow.steps.flatMap((step) => step.blockIds))),
    unmapped = blocks.filter((block) => !used.has(block.id)),
    first = unmapped[0];
  if (first)
    flows.push({
      id: flowIdSchema.parse('unmapped'),
      title: 'Unmapped evidence',
      subtitle: 'Not assigned to a flow',
      summary: 'The inferred map omitted these blocks. Review them here.',
      steps: [
        evidenceStep(first, 'unmapped-' + first.id, 'No inferred flow references this block.'),
        ...unmapped
          .slice(1)
          .map((block) =>
            evidenceStep(block, 'unmapped-' + block.id, 'No inferred flow references this block.'),
          ),
      ],
    });
  const firstFlow = flows[0];
  if (!firstFlow) throw new Error('AI returned no flows.');
  return [firstFlow, ...flows.slice(1)];
}
