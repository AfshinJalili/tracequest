import { z } from 'zod';

export const MAX_NOTE_CHARACTERS = 20_000;
export const MAX_IMPORT_BYTES = 3_000_000;
export const MAX_BLOCK_LINES = 56;
export const MAX_AUTHORED_STEPS = 120;
export const blockIdSchema = z.string().min(1).brand<'BlockId'>();
export const stepIdSchema = z.string().min(1).brand<'StepId'>();
export const flowIdSchema = z.string().min(1).brand<'FlowId'>();
export const evidenceKindSchema = z.enum(['Entry', 'Logic', 'Boundary', 'Data', 'Proof']);
export const fileSchema = z.object({
  filename: z.string().min(1),
  previous_filename: z.string().min(1).optional(),
  patch: z.string().optional(),
  additions: z.number().int().nonnegative().default(0),
  deletions: z.number().int().nonnegative().default(0),
});
export const contextSchema = z
  .object({
    path: z.string().min(1),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  })
  .refine((value) => value.end >= value.start, 'Invalid source range');
export const blockSchema = z.object({
  id: blockIdSchema,
  path: z.string().min(1),
  title: z.string(),
  code: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  kind: evidenceKindSchema.default('Logic'),
  missing: z.boolean().default(false),
});
export const stepSchema = z.object({
  id: stepIdSchema,
  title: z.string().min(1).max(160),
  kind: evidenceKindSchema,
  summary: z.string(),
  input: z.string(),
  output: z.string(),
  question: z.string(),
  blockIds: z.tuple([blockIdSchema]).rest(blockIdSchema),
  context: contextSchema.optional(),
});
export const flowSchema = z.object({
  id: flowIdSchema,
  title: z.string().min(1),
  subtitle: z.string().default(''),
  summary: z.string().default(''),
  actor: z.string().default(''),
  trigger: z.string().default(''),
  authorization: z.string().default(''),
  steps: z.tuple([stepSchema]).rest(stepSchema),
});
const commitSchema = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) });
export const prSchema = z.object({
  title: z.string().min(1),
  number: z.number().int().positive().optional(),
  html_url: z
    .url()
    .refine(
      (url) => new URL(url).hostname === 'github.com' && new URL(url).protocol === 'https:',
      'Source must be a GitHub HTTPS URL',
    )
    .optional(),
  body: z.string().nullable().optional(),
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  changed_files: z.number().int().nonnegative().optional(),
  head: commitSchema.optional(),
  base: commitSchema.optional(),
});
export const packSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  pr: prSchema,
  files: z.array(fileSchema).max(3000),
  blocks: z.tuple([blockSchema]).rest(blockSchema),
  flows: z.array(flowSchema),
  mapping: z.enum(['evidence', 'authored', 'curated', 'candidate', 'ai']),
  unmapped: z
    .array(z.object({ blockId: blockIdSchema, reason: z.string().trim().min(1) }))
    .default([]),
  authorship: z
    .object({
      author: z.string().trim().min(1),
      sourceFingerprint: z.string().min(1),
      contextReviewed: z.array(z.string().min(1)).min(1),
      missingContext: z.array(z.string().min(1)),
      verificationNotes: z.string().trim().min(1),
    })
    .optional(),
  sources: z.record(z.string(), z.string()).default({}),
  entities: z.array(z.string()).default([]),
});
export const positionSchema = z.object({ flow: flowIdSchema, step: stepIdSchema });
export const stateSchema = z.object({
  status: z.record(z.string(), z.enum(['done', 'flag'])).default({}),
  stepStatus: z.record(z.string(), z.enum(['done', 'flag'])).default({}),
  notes: z.record(z.string(), z.string().max(MAX_NOTE_CHARACTERS)).default({}),
  position: positionSchema.nullable(),
  updated: z.number().default(0),
});
export const sessionSchema = z.object({ pack: packSchema, state: stateSchema });
export type ChangedFile = z.infer<typeof fileSchema>;
export type PullRequest = z.infer<typeof prSchema>;
export type BlockId = z.infer<typeof blockIdSchema>;
export type StepId = z.infer<typeof stepIdSchema>;
export type FlowId = z.infer<typeof flowIdSchema>;
export type EvidenceBlock = z.infer<typeof blockSchema>;
export type ReviewStep = z.infer<typeof stepSchema>;
export type ReviewFlow = z.infer<typeof flowSchema>;
export type ReviewPack = z.infer<typeof packSchema>;
export type ReviewState = z.infer<typeof stateSchema>;
export type ReviewSession = z.infer<typeof sessionSchema>;
export type Position = z.infer<typeof positionSchema>;
