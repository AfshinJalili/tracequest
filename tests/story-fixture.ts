import { buildPack, sourceFingerprint, validatePack, type ReviewPack } from '@/domains/review';

export const storySources = {
  'AGENTS.md': 'Reject invalid quantities before returning reservation data.\n',
  'docs/reservation.md':
    'The caller establishes ownership. This example has no database or side effects.\n',
  'api.mjs':
    'import { reserve } from "./service.mjs";\nexport function reserveForUser(ctx, input) {\n  if (!ctx.userId) throw new Error("UNAUTHENTICATED");\n  if (ctx.userId !== input.ownerId) throw new Error("FORBIDDEN");\n  return reserve(input);\n}\n',
  'service.mjs':
    'export function reserve(input) {\n  if (input.quantity < 1) throw new Error("INVALID_QUANTITY");\n  return { ownerId: input.ownerId, quantity: input.quantity };\n}\n',
};
export const storyBaseSource =
  'export function reserve(input) {\n  return { ownerId: input.ownerId, quantity: input.quantity };\n}\n';

export function storyPack(
  evidence = buildPack(
    {
      title: 'Reject invalid reservation quantities',
      base: { sha: '0'.repeat(40) },
      head: { sha: '1'.repeat(40) },
    },
    [
      {
        filename: 'service.mjs',
        patch:
          '@@ -1,3 +1,4 @@\n export function reserve(input) {\n+  if (input.quantity < 1) throw new Error("INVALID_QUANTITY");\n   return { ownerId: input.ownerId, quantity: input.quantity };\n }',
        additions: 1,
        deletions: 0,
      },
    ],
  ),
): ReviewPack {
  const references = [
    { path: 'service.mjs', start: 1, end: 4 },
    { path: 'api.mjs', start: 2, end: 5 },
  ];
  const example = {
    title: 'Reserve two units',
    basis: 'traced',
    preconditions:
      'Illustrative values: caller user 42 owns the request. This function returns data without writing rows.',
    input: 'reserveForUser({ userId: "42" }, { ownerId: "42", quantity: 2 })',
    output: '{"ownerId":"42","quantity":2}',
    stateChange: 'No database write or external call.',
    references,
  };
  const proposed = {
    ...evidence,
    mapping: 'authored',
    sources: storySources,
    flows: [
      {
        id: 'reserve-owned-quantity',
        title: 'Reserve a positive quantity for the current owner',
        actor: 'Authenticated application caller',
        trigger: 'reserveForUser(ctx, input)',
        authorization: 'The unchanged caller requires a user and matches userId to ownerId.',
        summary:
          'The caller checks ownership. The service now rejects quantities below one before returning reservation data.',
        story: {
          input: 'Current user, owner ID, and requested quantity',
          output: 'Reservation data or a named error',
          examples: [
            example,
            {
              ...example,
              title: 'Reject zero units',
              input: 'reserveForUser({ userId: "42" }, { ownerId: "42", quantity: 0 })',
              output: 'INVALID_QUANTITY',
            },
          ],
        },
        steps: [
          {
            id: 'validate-reservation-quantity',
            title: 'Reject a quantity below one',
            kind: 'Logic',
            summary:
              'After the caller establishes ownership, the service rejects quantity 0. Positive quantities return the owner ID and quantity unchanged.',
            input: 'Owned request { ownerId: "42", quantity: 2 }',
            output: 'The same owner and quantity, or INVALID_QUANTITY before the return',
            question:
              'Does the caller validate that quantity is numeric before invoking this function?',
            blockIds: evidence.blocks.map((block) => block.id),
            context: references[0],
            rationale: {
              text: 'The guard prevents a zero or negative quantity from reaching the return. It does not validate the numeric type.',
              basis: 'source',
              references,
            },
            examples: [example],
          },
        ],
      },
    ],
    authorship: {
      author: 'Source-traced test fixture',
      method: 'story-v1',
      sourceFingerprint: 'pending',
      contextReviewed: Object.keys(storySources),
      missingContext: ['Numeric transport validation is outside this fixture.'],
      verificationNotes:
        'Synthetic source fixture. Executed examples are added only by the CLI integration test after running the code.',
    },
  };
  return validatePack({
    ...proposed,
    authorship: { ...proposed.authorship, sourceFingerprint: sourceFingerprint(proposed) },
  });
}
