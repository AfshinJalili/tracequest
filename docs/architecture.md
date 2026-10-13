# Application ownership

`src/domains/review` owns the review. It parses evidence, validates flow references, decides inspection eligibility, computes progress, transfers notes, and produces presentation values. Its public API is `index.ts`; its rules are in `RULES.md`.

`src/domains/preferences` owns browser-wide application preferences and their defaults. Keyboard shortcut settings apply across reviews and are persisted separately from PR progress. The review domain cannot own this setting because importing or replacing a review must not reset it.

`src/integrations` adapts GitHub, files, the demo, and OpenAI-compatible APIs to that contract. External JSON enters as unknown and is validated before use. Model credentials stay in React memory for the current tab.

`src/persistence` owns browser storage, schema validation, and migration from the prototype's numeric checkpoints. Imported files, notes, selected steps, and evidence IDs retain their meaning across that migration.

`src/features` composes each user task with React. Components display domain values. The review controller calls domain transitions and persistence; it does not define inspection rules. `src/components/ui` contains official shadcn primitives. `src/app` owns routing.

Review navigation owns the desktop and mobile view choices. Unmapped evidence is an explicit screen; choosing a file or page clears the highlighted block without closing the browser. Each import owns its cancellation controller, so a late response cannot replace a newer review. Source-context and model responses also check their own cancellation state. The request-signal adapter combines caller cancellation with the service deadline.

Evidence intake and authored review are two stages in the existing review domain. An evidence pack has no flows and a null checkpoint. `reviewView` returns a discriminated union: only the review branch exposes a selected step, navigation, and inspection eligibility. The evidence branch supplies grouped files, coverage, missing context, and explicit unmapped reasons. The UI can therefore render raw code without pretending it is a review plan.

A placeholder flow for raw imports was considered. It would make file chunks look like behavior steps and require fabricated explanations. A separate evidence business domain would duplicate source identity and persistence. Keeping stages in the owning review module costs less to maintain and makes promotion explicit. Candidate and patch-only AI mapping code was deleted, including its model adapter. Curated legacy backups and the shipped demo remain compatible; new authored plans have stricter metadata and source checks.

`validation.ts` owns pack integrity and the source fingerprint. `source-verification.ts` owns source comparison using plain values. `scripts/verify-review-pack.mjs` reads a real checkout and bundles the domain contract in memory, so the CLI and app use the same schemas and validation rules. A checksum is a freshness check, not proof that an agent read the context or understood the code. Semantic review and an app walkthrough are separate handoff requirements in [agent-review.md](agent-review.md).

The chosen shape is a Vite React SPA. A Next.js application with server persistence was considered. This app currently needs no shared database or server credentials; adding one would add operating cost without fulfilling a requirement. Hash routing works on static hosts without rewrite configuration.

The first migration commit extracted inspection and note-transfer rules with prototype tests green. The framework migration then replaces the old presentation and adapters. Prototype source remains in Git history rather than as a second implementation.

`npm run check` gates strict TypeScript, domain and adapter imports, platform access, unsafe application casts, tests, and the production build. Vendor component assertions are exempt from the application-cast gate because they are upstream implementation details.

The UI uses the approved black palette, system sans-serif stack, warm model labels, restrained blue actions, and the same corners. Named step selection replaces the numeric strip. Mobile uses shadcn tabs and a sheet. Code wrapping is confined to mobile so long identifiers remain inspectable.
