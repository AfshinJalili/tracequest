# Constraints

Constraints, not a checklist; when two conflict, pick the lowest future cost for this repo and say so in the commit.

- Separation of concerns: domain, persistence, presentation, and routing each go where the community standard of this project's framework, tool, or workspace puts them. If the repo already has a place for that concern, use it. Name the one concern of the file you edit.
- Encapsulation: public contracts only; read another module's tables and caches through its functions.
- Cohesion / coupling: one rule change touches one module.
- DRY: grep before writing logic; one home per rule, threshold, format or schema fact. Do not abstract coincidental similarity.
- KISS / YAGNI: simplest working shape; function over class; no speculative hooks, flags or frameworks.
- Single responsibility: if you describe it with "and", split it. Names say intent; comments say why.
- Depend on contracts: domain code takes and returns plain values. Keep the framework's request, response, and template types out of it.
- Composition over inheritance · open/closed only where change has happened twice · Demeter (no a.b.c.d) · fail fast (validate at edges, never swallow errors) · optimize for deletion · boring tech.

The hard invariants:

10. One owning module per domain. Each business domain's logic lives in one module with its rules doc; everyone else calls it. Consolidate a scattered domain before adding to it. Extend the domain's existing module; create a new one only when you can say why the old one cannot own it. A new rule goes in its domain's owner, not in the first feature that needs it. A function-level import to dodge a cycle means the logic is in the wrong module.
11. One copy of each rule. On the second use of existing logic: (1) move it to a shared module, (2) switch the original caller, tests green, no behaviour change, (3) then build the new use. First grep for the expression (the arithmetic, the format string, the threshold) and list every copy; the move switches them all or the commit names each one left and why. A new helper beside old copies is one more duplicate. The move keeps each caller's exact results (guards, rounding, clamps); any behaviour change is its own commit. Same for schemas (one fact, one column) and repeated UI (one component per repeated piece).
12. Rendering displays values. Templates, view code, routes, and view builders show values the owning module already computed. Who sees a value is decided in domain code.

How to work:

Refactor first, then change: a behaviour-preserving refactor with tests green, then the change. Keep them out of one unverifiable diff.

Gates, not promises. A prompted "never" alone does not hold; a rule that matters is enforced by CI or a hook.

For PR review content, follow [docs/agent-review.md](docs/agent-review.md). Raw evidence is not a review plan. Do not claim a PR is ready for review from importer, persistence, or UI tests; report source verification, semantic review, missing context, and app inspection separately.
