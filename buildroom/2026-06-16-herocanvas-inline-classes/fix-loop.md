# Fix Loop

## 2026-06-16 TypeScript canvas nullability blocker

- Changed `components/HeroCanvas.tsx` to copy the guarded canvas ref into a non-null `HTMLCanvasElement` alias before nested callbacks use it.
- Updated `resize()` to write through the non-null alias, resolving the reported `canvas is possibly null` TypeScript error without expanding scope.
- Verification result: `npm run verify:portal` failed during `next build` because Next/font could not fetch `Barlow Condensed` and `Inter` from Google Fonts in the restricted network environment. Lint completed with existing warnings, and the reported `HeroCanvas.tsx` TypeScript nullability error did not reappear before the font fetch failure.

## 2026-06-16 TypeScript context nullability blocker

- Changed `components/HeroCanvas.tsx` to copy the guarded 2D canvas context into a non-null `CanvasRenderingContext2D` alias before nested callbacks use it.
- Updated the local render context, grid drawing, and animation clear call to use the non-null alias, preserving the existing drawing behaviour.
- Verification result: `npm run verify:portal` failed during `next build` because Next/font could not fetch `Barlow Condensed` and `Inter` from Google Fonts in the restricted network environment. Lint completed with existing warnings, and the reported `HeroCanvas.tsx` context nullability error did not reappear before the font fetch failure.
