# Review rules

This module owns evidence identity, flow integrity, review transitions, coverage, note transfer, and the values visible to presentation.

- Import preserves every patch line. Block IDs stay stable for identical source.
- Raw imports are evidence intake: no flows, no steps, and no selected review position. Symbol guesses and old patch-only AI drafts cannot activate the review screen.
- Raw diff input is limited to 3 MB. Saved review JSON accepts up to 30 MB because it also contains structured evidence, source context, notes, and checkpoints. Import controls and guards read the same limit metadata.
- A flow has at least one step. A step references at least one existing block.
- `validatePack` owns structural validation. Evidence IDs, code and ranges must match the canonical patch parse; IDs must be unique and references must resolve.
- An authored plan requires pinned base/head commits, project context, authorship metadata, behavior descriptions, actor, trigger, authorization, and step inputs/outputs/questions. Generic decorator/constructor flow names are rejected. Related blocks share behavior steps; the schema owns the authored-step limit.
- Every block in a plan is assigned to a step or explicitly listed in `unmapped` with a reason. Unmapped code never becomes a fake flow and is visible in Coverage and the evidence browser.
- Source context in authored steps must exist and fit within the cached full file. The source fingerprint detects stale snapshots; it is not a signature or a semantic-quality certificate.
- `verifySourceSnapshot` checks a supplied repository snapshot against base/head pins, all changed paths, cached full files, and complete patch reconstruction. The CLI supplies Git values and stamps only after successful verification. Unavailable patches remain visible and cannot be inspected.
- The shipped curated demo and old curated backups remain compatible. Their older context ranges are tolerated; authored imports use the strict contract. Legacy candidate/AI content is preserved as evidence requiring curation.
- A step can be marked reviewed or flagged only after all available blocks are opened. Missing patches block inspection.
- Shared evidence counts once in coverage. A flag remains until every referencing flagged step is resolved.
- Replacing a plan requires the same evidence snapshot and pinned head. It carries notes and flags by overlapping evidence IDs. New flow steps require a fresh review.
- Inspected code is not PR approval.

Adapters import the public `index.ts`. Internal files are private to this owner. CI checks the dependency boundary and the absence of browser, React, and persistence APIs in this module.
