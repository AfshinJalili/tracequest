# TraceQuest

Review backend pull requests by behavior. Follow a flow, read each step's source, flag concerns, and resume from a saved checkpoint.

The app uses React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix primitives, React Router, and Zod. Its black palette, system fonts, compact sidebar, blue actions, and warm model labels match the approved desktop and mobile designs.

## Run locally

Use Node.js 24.

```sh
npm ci
npm run dev
```

Open the Vite URL printed in your terminal. The included Vendure PR #5259 demo has 4 flows, 15 steps, and 14 evidence blocks pinned to the PR's head commit.

## Review a pull request

Open **Review actions → Import PR**. Import a public GitHub URL, a unified `.diff` or `.patch`, or an exported review JSON file. For a private repository, generate a diff locally with `git diff base...HEAD`.

Select a named step and open every code block before marking it reviewed. Flags and notes stay attached to their step. Coverage counts shared evidence once. Inspection records progress; it does not approve a PR.

Raw imports open **Evidence**, with a file picker and paged code blocks. They contain no review flows or steps. Open **Agent review** to export a brief for a coding agent with access to the full repository, then import its authored review JSON. Unmapped evidence and missing project context remain visible.

Follow the [agent review workflow](docs/agent-review.md). The agent must read project docs, unchanged callers, models, authorization, and tests; explain behavior; and check its pack against the pinned source before handoff. A valid JSON file alone does not establish review quality.

## Connect an AI provider

Open **AI settings** and enter an OpenAI-compatible HTTPS base URL, model ID, and API key. The endpoint must allow browser CORS requests. The key stays in tab memory and is never saved or exported.

Questions send only the current step's evidence and available pinned context. Without credentials, copy that context into ChatGPT or a coding agent. Authoring a review plan uses the full-repository agent workflow rather than a patch-only model request.

## Check changes

```sh
npm run check
```

CI checks strict types, module boundaries, domain tests, React interactions, adapters, storage migration, a source-verifier run against a real Git fixture, and the production build. Run `npm run test:watch` while changing review rules.

To check an authored pack against the repository it describes:

```sh
npm run verify:pack -- --pack review.json --repo /path/to/checkout --stamp
```

The command checks base/head commits, changed files, complete patches, cached context, references, and evidence accounting. It cannot validate the meaning of an explanation.

The automated interaction tests use the actual React components and demo snapshot. External HTTP/model responses are controlled in tests. Live provider connectivity requires credentials. Visual browser QA is unavailable in the current build environment.

## Build and host

```sh
npm run build
```

Serve `dist/` on any static host. Hash routing works without server rewrites. The Sites hosting manifest is deployment metadata, not an application dependency.

See [architecture](docs/architecture.md), [review rules](src/domains/review/RULES.md), and [AGENTS.md](AGENTS.md) before changing ownership or behavior. The behavior-preserving domain extraction is a separate commit before the framework migration.

## Attribution

The vendored UI primitives come from the official shadcn/ui registry. `scripts/vendor-ui.py` is the reproducible fallback for the registry CLI's unavailable proxy path; ordinary component updates can use `npx shadcn add`.

Vendure source in the demo and test fixture belongs to its respective authors and retains its upstream license, included under `public/licenses/`. The application source and vendored components have their own license files. No private PR content or model credentials are part of the public source.
