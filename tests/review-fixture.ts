import demo from '../public/demo.json';
import { buildPack, sourceFingerprint, validatePack } from '@/domains/review';

export function partlyMappedReview() {
  const evidence = buildPack(
    { title: 'Validate requests', base: { sha: '0'.repeat(40) }, head: { sha: '1'.repeat(40) } },
    ['entry.ts', 'large-service.ts', 'other-service.ts'].map((filename, index) => {
      const count = index === 1 ? 1500 : 1;
      return {
        filename,
        patch: `@@ -0,0 +1,${count} @@\n` + '+reserve();\n'.repeat(count).trimEnd(),
        additions: count,
        deletions: 0,
      };
    }),
  );
  const first = evidence.blocks[0];
  const sample = authoredDemo(),
    flow = sample.flows[0];
  if (!first || !flow) throw new Error('Fixture missing');
  const step = flow.steps[0];
  const proposed = {
    ...evidence,
    mapping: 'authored',
    sources: { 'AGENTS.md': 'Fixture rules\n' },
    flows: [
      {
        ...flow,
        title: 'Validate requests',
        steps: [{ ...step, context: undefined, blockIds: [first.id] }],
      },
    ],
    unmapped: evidence.blocks
      .slice(1)
      .map((block) => ({ blockId: block.id, reason: 'Requires another behavior review' })),
    authorship: {
      author: 'Test fixture',
      sourceFingerprint: 'pending',
      contextReviewed: ['AGENTS.md'],
      missingContext: ['Synthetic source fixture'],
      verificationNotes: 'UI test data only',
    },
  };
  return validatePack({
    ...proposed,
    authorship: { ...proposed.authorship, sourceFingerprint: sourceFingerprint(proposed) },
  });
}

export function authoredDemo() {
  const pack = validatePack(demo);
  const proposed = {
    ...pack,
    mapping: 'authored',
    pr: { ...pack.pr, base: { sha: '0'.repeat(40) } },
    flows: pack.flows.map((flow) => ({
      ...flow,
      actor: 'Shop or admin request',
      trigger: flow.title,
      authorization: 'Verify the resolver permission and transaction before calling the service',
    })),
    authorship: {
      author: 'Review agent',
      sourceFingerprint: 'pending',
      contextReviewed: Object.keys(pack.sources),
      missingContext: [
        'Project configuration and full test execution were not included in this fixture',
      ],
      verificationNotes:
        'Fixture verifies data preservation, not the semantic quality of a private PR.',
    },
  };
  return validatePack({
    ...proposed,
    authorship: { ...proposed.authorship, sourceFingerprint: sourceFingerprint(proposed) },
  });
}
export function largeBackendFiles() {
  return Array.from({ length: 73 }, (_, index) => {
    const extension =
      index < 23
        ? 'controller.ts'
        : index < 47
          ? 'service.ts'
          : index < 58
            ? 'entity.ts'
            : 'spec.ts';
    const source = [
      'export class Module' + index + ' {',
      ' constructor(private service: OrderService) {}',
      ' @Mutation()',
      " async create(@Args('input') input: Input) {",
      ...Array.from({ length: 107 }, () => '  this.service.reserve(input);'),
      ' }',
      '}',
    ];
    return {
      filename: `module-${index}.${extension}`,
      patch: '@@ -0,0 +1,' + source.length + ' @@\n' + source.map((line) => '+' + line).join('\n'),
      additions: source.length,
      deletions: 0,
    };
  });
}
