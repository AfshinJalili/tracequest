# Application ownership

`src/domains/review` owns the review. It parses evidence, validates flow references, decides inspection eligibility, computes progress, transfers notes, and produces presentation values. Its public API is `index.ts`; its rules are in `RULES.md`.

`src/domains/preferences` owns browser-wide application preferences and their defaults. Keyboard shortcut settings apply across reviews and are persisted separately from PR progress. The review domain cannot own this setting because importing or replacing a review must not reset it.

`src/integrations` adapts GitHub, files, the demo, and OpenAI-compatible APIs to that contract. External JSON enters as unknown and is validated before use. Model credentials stay in React memory for the current tab.

`src/persistence` owns browser storage, schema validation, and migration from the prototype's numeric checkpoints. Imported files, notes, selected steps, and evidence IDs retain their meaning across that migration.

`src/features` composes each user task with React. Components display domain values. The review controller calls domain transitions and persistence; it does not define inspection rules. `src/components/ui` contains official shadcn primitives. `src/app` owns routing.

The chosen shape is a Vite React SPA. A Next.js application with server persistence was considered. This app currently needs no shared database or server credentials; adding one would add operating cost without fulfilling a requirement. Hash routing works on static hosts without rewrite configuration.

The first migration commit extracted inspection and note-transfer rules with prototype tests green. The framework migration then replaces the old presentation and adapters. Prototype source remains in Git history rather than as a second implementation.

`npm run check` gates strict TypeScript, domain and adapter imports, platform access, unsafe application casts, tests, and the production build. Vendor component assertions are exempt from the application-cast gate because they are upstream implementation details.

The UI uses the approved black palette, system sans-serif stack, warm model labels, restrained blue actions, and the same corners. Named step selection replaces the numeric strip. Mobile uses shadcn tabs and a sheet. Code wrapping is confined to mobile so long identifiers remain inspectable.
