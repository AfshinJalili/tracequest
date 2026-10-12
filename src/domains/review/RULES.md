# Review rules

This module owns evidence identity, flow integrity, review transitions, coverage, note transfer, and the values visible to presentation.

- Import preserves every patch line. Block IDs stay stable for identical source.
- A flow has at least one step. A step references at least one existing block.
- Unknown evidence IDs invalidate an imported or AI-generated map.
- Omitted evidence becomes an unmapped flow.
- A step can be marked reviewed or flagged only after all available blocks are opened. Missing patches block inspection.
- Shared evidence counts once in coverage. A flag remains until every referencing flagged step is resolved.
- Remapping carries notes and flags by overlapping evidence IDs. New flow steps require a fresh review.
- Inspected code is not PR approval.

Adapters import the public `index.ts`. Internal files are private to this owner. CI checks the dependency boundary and the absence of browser, React, and persistence APIs in this module.
