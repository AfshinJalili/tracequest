# Application preferences

This module owns settings that apply across reviews. Review progress stays in the review domain.

- Keyboard shortcuts are enabled unless the user disables them.
- A saved preference must match the public schema before presentation uses it.
- Model credentials are tab-local and are never application preferences.
- Storage and React state live in their adapters, outside this module.
