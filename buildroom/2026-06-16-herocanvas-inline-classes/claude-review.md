# Independent Review — HeroCanvas inline-class hoist

**Reviewer:** Claude (independent)
**Date:** 2026-06-16
**Scope reviewed:** `git diff` for `components/HeroCanvas.tsx` against
`work-item.md` and `execution-plan.md`.

## Verdict

**PASS**

The refactor hoists `Cog`, `Pipe`, `IBeam`, `Bolt`, and `DimensionLine` to module
scope, removes the React-compiler inline-class warning, preserves animation
behaviour, and stays inside scope. All success criteria are met and verified.

---

## Verification performed (not trusting builder summary)

- Inspected the full unified diff (326 insertions / 302 deletions, single file).
- Diffed the new module-scope classes line-by-line against the original
  in-hook classes from `HEAD:components/HeroCanvas.tsx`.
- `npm run lint`: the `Compilation Skipped: Inline class declarations are not
  supported` warning **no longer appears for `components/HeroCanvas.tsx`**.
  (It only appeared for a throwaway `buildroom/orig_hero.tsx` copy I created
  during review, which I have since deleted — it was not a builder artifact.)
- `npm run build`: succeeds.
- `npm run verify:portal` (lint + build + check:shift-ai-inputs): **exit 0**.
- `git diff --stat`: only `components/HeroCanvas.tsx` changed. No unrelated
  cleanup, no dependency changes, no other files touched.

---

## Behavioural-equivalence audit (the items flagged for special attention)

All confirmed equivalent:

- **Canvas dimensions (`w`, `h`)** — Original used closure `let w, h` set in
  `resize()`. New code uses a single `runtime: RuntimeSize` object mutated
  in-place by `resize()` (`runtime.width = canvasElement.width = ...`). Because
  `runtime` is mutated rather than replaced and is passed by reference into
  `update`/`reset`/constructors at call time, every consumer reads the current
  dimensions — identical to closure semantics. `clearRect` now uses
  `runtime.width/height` instead of `w/h`; equivalent.

- **Canvas rendering context** — Original used `ctx!` (non-null assertion)
  everywhere. New code narrows once to `const context: CanvasRenderingContext2D`
  and passes it via `renderContext.ctx`. Same single context instance; the
  non-null assertions are removed cleanly (a type-safety improvement, no
  behaviour change). Canvas element similarly narrowed to `canvasElement`.

- **Color** — Original `const blue = [224, 64, 208]`; new
  `const HERO_BLUE = [224, 64, 208] as const`, passed through `RenderContext`
  and re-read locally in `drawGrid`. Identical RGB values, identical rgba
  string construction.

- **Random initialization** — All `Math.random()` expressions are byte-for-byte
  identical (cog angles, pipe segments/dots/speed/opacity, ibeam rotSpeed/drift,
  bolt positions/size/opacity/pulsePhase, dimension-line geometry). Construction
  order in `initElements()` is unchanged.

- **Resize reinitialization** — `resize(); initElements();` initial call order
  preserved, and `handleResize = () => { resize(); initElements(); }` preserved.
  `resize()` runs before `initElements()` so dimensions are populated before
  elements are built, exactly as before.

- **Drawing order** — Unchanged in `animate()`:
  `drawGrid → dims → pipes → ibeams → cogs → bolts`, with the same
  `update()`/`draw()` pairing per element and `t++` timing for bolts
  (`b.update(t)` preserved; `Cog.update()` remains arg-less).

---

## Non-blocking observations (nits)

1. **`Pipe.getPointAtProgress` fallback** — Original returned
   `this.segments[0]` when `segments.length < 2`; new returns
   `this.segments[0] ?? { x: 0, y: 0 }`. In practice `reset()` always pushes at
   least one segment before this runs, so the `?? {x:0,y:0}` branch is never
   taken — purely a defensive type tweak, no behavioural difference. Harmless.

2. **Diff size vs. logical change** — The 628-line diff looks large but is
   almost entirely the mechanical relocation of the class bodies out of the
   `useEffect` plus `ctx!`→`ctx`/`context` and `w`/`h`→`width`/`height`/`runtime`
   rewrites. Not overbroad; consistent with the plan.

No functional bugs, missed edge cases, broken assumptions, or
security/auth/data risks found. No tests exist for this purely-visual component
and none were required by the work item; `verify:portal` is the agreed gate and
it passes.

## Success-criteria check

| Criterion | Result |
|---|---|
| Classes no longer defined inside `HeroCanvas`/`useEffect` | PASS — all 5 at module scope |
| React inline-class compiler warning removed | PASS — gone from lint output |
| `npm run verify:portal` passes | PASS — exit 0 |
| No unrelated broad cleanup | PASS — single file, scoped changes |
