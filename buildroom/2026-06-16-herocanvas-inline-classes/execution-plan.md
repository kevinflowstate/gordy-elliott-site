# Execution Plan

## Intended areas/files
- `components/HeroCanvas.tsx`
- `buildroom/2026-06-16-herocanvas-inline-classes/*` artifacts

## Likely changes
- Hoist animation helper classes to module scope.
- Remove closures over `ctx`, `blue`, `w`, and `h` from those classes by passing a small render/runtime context or explicit parameters into `draw`, `update`, and `reset` methods.
- Keep random initialization, movement, fading, drawing order, and resize reinitialization semantics equivalent to the current implementation.

## Test strategy
- Run `npm run verify:portal` after implementation.
- Hermes independently inspects diff to ensure class declarations are no longer inside hook/component.
- Hermes checks `git diff --stat` and targeted diff for broad unrelated cleanup.

## Risks
- Behaviour changes if classes lose access to current canvas dimensions or color values.
- Type regressions around canvas context passing.
- Subtle differences in reset/update logic if hoisting is over-abstracted.

## Loop policy
- Max review/fix loops: 3
- Stop if verification still fails after loop 3
- Stop on missing credentials, destructive migrations, external sends, production deploys, or ambiguous product decisions
