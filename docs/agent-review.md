# Author a review pack

TraceQuest separates evidence intake from a behavior review. Importing a diff preserves code; it does not establish a call graph, explain a mutation, or show that the PR is ready to review. An agent with repository access authors the plan. The reviewer then follows that plan and checks its evidence.

## Collect the snapshot

Import the GitHub PR or local diff into TraceQuest and choose **Export evidence**. Give the exported JSON and the **Agent review** brief to a coding agent. The agent also needs a checkout of the actual repository and the PR description. A diff by itself is insufficient.

Record full 40-character commit SHAs for the comparison base and head. Check out the head. For a PR or branch comparison, use its merge base as the comparison base; the GitHub API's base-branch tip can differ from the commit used to produce the PR diff:

```sh
git rev-parse HEAD
git merge-base main HEAD
git diff BASE_SHA HEAD_SHA
```

Replace the placeholders with the resolved SHAs. Preserve the exported `files`, `blocks`, block IDs, code, and ranges. If the diff or commit changes, export a new snapshot and re-author affected flows. Do not silently attach old explanations to new code.

## Read the project before writing steps

Read the PR description, repository AGENTS.md, domain rules, and relevant architecture docs. Trace changed entry points through unchanged callers, service functions, repositories, models, and tests. Include authorization and request ownership, input validation, transactions, external calls, mutations, caches, events, retries, failure paths, and observable outputs where they apply.

Cache the full head-version text of reviewed context files in `sources`, keyed by repository-relative path. Context includes unchanged files, not just patch fragments. Name those paths in `authorship.contextReviewed`. Record absent docs, unresolved callers, unavailable patches, inaccessible services, or unrun tests in `missingContext`. Do not replace gaps with guesses.

Separate observed behavior from inference. Run relevant tests when possible and record the actual commands and outcomes in `verificationNotes`; never invent results. A source check alone does not prove that an explanation is correct.

## Describe behavior

Make each flow a functionality with an actor, trigger, authorization boundary, and outcome. Name flows after behavior, such as “Create an order for the current customer.” Names such as “Trace Args” or “Trace constructor” are rejected.

Order steps by execution and data transitions, including significant failure branches. Each step explains what happens, its input, its output or mutation, and a concrete review question. Use multiple `blockIds` when they support one behavior; share evidence between flows when appropriate. Splitting every code chunk into a step repeats the bug. The app caps authored plans at 120 steps; group supporting contracts and tests into the behavior they prove.

Account for every block: reference it in a step or give an explicit `unmapped` reason. Generated files, unrelated formatting, or a behavior that lacks enough context can remain unmapped. Unmapped code remains visible and unreviewed. Missing patches cannot be marked inspected.

Start from the evidence JSON, set `mapping` to `authored`, add `pr.base` and `pr.head`, and replace `flows`. This example shows the fields to add; IDs and context paths must come from the actual exported snapshot:

```json
{
  "mapping": "authored",
  "flows": [
    {
      "id": "create-order",
      "title": "Create an order for the current customer",
      "subtitle": "Shop API",
      "summary": "Validate ownership, lock the customer, and persist the active order in one transaction.",
      "actor": "Authenticated customer",
      "trigger": "createOrder mutation",
      "authorization": "The resolver requires a customer identity; the service checks order ownership.",
      "steps": [
        {
          "id": "lock-customer",
          "title": "Lock the customer before creating the order",
          "kind": "Boundary",
          "summary": "The transaction locks the customer row before checking for an existing active order.",
          "input": "Customer ID and request transaction",
          "output": "A locked customer row or a not-found error",
          "question": "Can every caller reach this lock inside the same transaction?",
          "blockIds": ["BLOCK_ID_FROM_EXPORT", "SECOND_BLOCK_ID_FROM_EXPORT"],
          "context": { "path": "src/orders/service.ts", "start": 30, "end": 72 }
        }
      ]
    }
  ],
  "unmapped": [
    {
      "blockId": "OTHER_BLOCK_ID_FROM_EXPORT",
      "reason": "Generated client update; inspect separately."
    }
  ],
  "authorship": {
    "author": "Repository review agent",
    "sourceFingerprint": "pending",
    "contextReviewed": ["AGENTS.md", "src/orders/service.ts", "src/orders/resolver.ts"],
    "missingContext": ["Database integration tests could not run without the test database."],
    "verificationNotes": "Record observed source links and actual tests here before handoff."
  }
}
```

Merge these fields into the evidence JSON, retaining `version`, `id`, `pr`, `files`, `blocks`, `sources`, and `entities`. Populate `sources` with full files and use truthful explanations specific to the PR. This example is a shape reference, not verified repository behavior. The runtime schema lives in `src/domains/review/schema.ts`; validation has one implementation in `validation.ts`.

## Check against the repository

From the TraceQuest checkout, run:

```sh
npm ci
npm run verify:pack -- --pack /path/to/review.json --repo /path/to/repository --stamp
```

The target checkout's HEAD must equal the pack's pinned head, and its declared base must exist. The command reads committed Git source rather than uncommitted working files. It checks the complete changed-file list, reconstructs each available patch from base to head, compares cached context, validates references and dispositions, and checks authored source ranges. Renamed files use `previous_filename` for the base path. Unavailable or binary patches remain reported gaps.

`--stamp` replaces the pending source fingerprint only after all checks succeed. Rechecking without `--stamp` also rejects stale fingerprints. The fingerprint is a non-cryptographic freshness checksum; it is not a trusted signature or proof of semantic quality. The app validates the pack's internal consistency when importing it; it cannot independently inspect your private checkout or attest that you ran the CLI.

The executable contract is tested in `tests/source-cli.test.ts` with a real temporary Git repository. Those tests verify the tool, not a user's PR. Line reconstruction normalizes CRLF and terminal line endings; cached context is compared exactly.

## Inspect and hand off

Import the full authored JSON using **Import authored review → File**, or paste it into **Agent review**. Walk each functionality in TraceQuest. Read the explanation with the expanded code, check the caller chain and mutations, inspect Coverage for unmapped or unavailable evidence, and verify that missing context is accurate. Revise weak steps and rerun source verification after source metadata changes.

Export the review file to preserve the authored explanations, code, notes, flags, and checkpoint. Reopen it to confirm the checkpoint survives. Export notes for a Markdown review record.

Report which pinned source was checked, which behaviors were traced, which tests actually ran, what remains unresolved, and whether the app walkthrough was performed. If browser access is unavailable, say so; component tests do not replace a visual walkthrough. Never call the PR review-ready solely because parsing, storage, or CI passed.

The bundled Vendure demo remains a curated example. Older curated backups still load; old symbol-derived or patch-only AI plans reopen as evidence requiring curation.
