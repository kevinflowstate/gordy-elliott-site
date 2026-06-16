# Work Item

## Goal
Refactor `components/HeroCanvas.tsx` so React compiler / ESLint no longer warns about inline class declarations inside React hooks/components, while preserving the canvas animation behaviour as closely as possible.

## Context
`origin/main` at `65075a5097f96e43c4555ed4fcb5e89f7fa4cf56` defines `Cog`, `Pipe`, `IBeam`, `Bolt`, and `DimensionLine` classes inside the `useEffect` body of `HeroCanvas`. `npm run verify:portal` currently passes but emits React compiler warnings: `Compilation Skipped: Inline class declarations are not supported` and `Move class declarations outside of components/hooks`.

## In scope
- Edit `components/HeroCanvas.tsx` to move/refactor inline class declarations out of the hook/component warning path.
- Preserve existing canvas rendering and animation behaviour as closely as possible.
- Keep changes focused and minimal.
- Update types/signatures as needed.

## Out of scope
- Visual redesign.
- Broad formatting cleanup.
- Changes outside `components/HeroCanvas.tsx` unless strictly needed for verification.
- New dependencies.

## Success criteria
- `HeroCanvas.tsx` no longer defines `Cog`, `Pipe`, `IBeam`, `Bolt`, or `DimensionLine` inside `HeroCanvas` or its `useEffect` callback.
- React compiler warning about inline class declarations is removed.
- `npm run verify:portal` passes.
- No unrelated broad cleanup.

## Verification commands
- `git diff --stat`
- Targeted diff inspection for `components/HeroCanvas.tsx`
- `npm run verify:portal`

## Constraints / stop conditions
- Max review/fix loops: 3.
- Stop on missing local credentials/tools that cannot be worked around without API credits.
- Stop if requested scope expands beyond this single refactor.
