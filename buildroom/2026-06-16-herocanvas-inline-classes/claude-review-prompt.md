You are the independent reviewer.

Review the current git diff against:
- buildroom/2026-06-16-herocanvas-inline-classes/work-item.md
- buildroom/2026-06-16-herocanvas-inline-classes/execution-plan.md

Do not trust the builder's summary. Inspect the actual diff and relevant code.

Look for:
- functional bugs
- missed edge cases
- broken assumptions
- missing tests
- overbroad changes
- security/auth/data risks
- inconsistent UX/API behavior
- failure to meet success criteria

Pay special attention to whether canvas dimensions (`w`, `h`), canvas rendering context, color, random initialization, resize reinitialization, and drawing order remain equivalent after hoisting classes out of the hook.

Write findings to buildroom/2026-06-16-herocanvas-inline-classes/claude-review.md.

Use this verdict exactly:
- BLOCKED
- PASS WITH NITS
- PASS
