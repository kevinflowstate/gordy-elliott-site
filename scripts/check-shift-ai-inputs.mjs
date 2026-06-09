import fs from "node:fs";

const files = {
  portal: "app/portal/ai/page.tsx",
  admin: "app/admin/ai/page.tsx",
  component: "components/ui/AIComposerTextarea.tsx",
  css: "app/globals.css",
};

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`SHIFT AI input regression: ${message}`);
  process.exitCode = 1;
}

function luminance(hex) {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((part) => parseInt(part, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

for (const path of [files.portal, files.admin]) {
  const source = read(path);
  if (!source.includes("AIComposerTextarea")) {
    fail(`${path} must use AIComposerTextarea for the composer.`);
  }
  if (/<textarea[\s>]/.test(source)) {
    fail(`${path} contains a raw textarea; use the shared AI composer contract.`);
  }
}

const component = read(files.component);
if (!component.includes('data-shift-ai-input="composer"') || !component.includes("shift-ai-input")) {
  fail("AIComposerTextarea must keep the data marker and shift-ai-input class.");
}
for (const marker of [
  'data-lpignore="true"',
  'data-1p-ignore="true"',
  'data-form-type="other"',
  'enterKeyHint={props.enterKeyHint ?? "send"}',
  'inputMode={props.inputMode ?? "text"}',
  "text-base",
]) {
  if (!component.includes(marker)) {
    fail(`AIComposerTextarea missing mobile composer marker: ${marker}.`);
  }
}

const css = read(files.css);
for (const selector of [
  ".shift-ai-input",
  ".shift-ai-input::placeholder",
  ".shift-ai-input:focus",
  ".shift-ai-input:disabled",
  ".shift-ai-input:-webkit-autofill",
  ".dark .shift-ai-input",
  ".dark .shift-ai-input::placeholder",
  ".dark .shift-ai-input:focus",
  ".dark .shift-ai-input:disabled",
]) {
  if (!css.includes(selector)) {
    fail(`missing CSS selector ${selector}.`);
  }
}
for (const marker of [
  "font-size: 16px !important",
  "--shift-ai-keyboard-inset",
  "--shift-ai-composer-height",
  ".shift-ai-composer-bar",
  ".shift-ai-thread",
  "html.shift-ai-composer-focused",
  "html.shift-ai-keyboard-open",
]) {
  if (!css.includes(marker)) {
    fail(`missing mobile keyboard CSS contract marker ${marker}.`);
  }
}

const portal = read(files.portal);
for (const marker of [
  "window.visualViewport",
  "shift-ai-composer-focused",
  "shift-ai-keyboard-open",
  "resetDocumentScroll",
  "pinLatestToComposer",
  "shift-ai-composer-bar",
  "shift-ai-thread",
]) {
  if (!portal.includes(marker)) {
    fail(`portal SHIFT AI missing keyboard stabilizer marker ${marker}.`);
  }
}

const bodyContrast = contrast("#171018", "#ffffff");
const placeholderContrast = contrast("#66606a", "#ffffff");
const disabledContrast = contrast("#6f6872", "#f2f0f3");

if (bodyContrast < 7) fail(`typed text contrast is too low: ${bodyContrast.toFixed(2)}.`);
if (placeholderContrast < 4.5) fail(`placeholder contrast is too low: ${placeholderContrast.toFixed(2)}.`);
if (disabledContrast < 4.5) fail(`disabled contrast is too low: ${disabledContrast.toFixed(2)}.`);

if (!process.exitCode) {
  console.log("SHIFT AI input contract OK");
}
