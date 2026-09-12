/**
 * Render a component under BOTH theme selectors and prove it does not care which.
 *
 * happy-dom applies no stylesheet, so a unit test cannot measure a colour — that is what
 * `theme-tokens.test.ts` does, from the CSS. What a component test CAN prove is the property
 * that makes the theming work at all (`globals.css`, "how theming works here"): a component
 * produces the SAME markup whichever theme is stamped on `<html>`, names only tokens, and
 * carries no literal colour. If those hold, the token audit's numbers are the component's
 * numbers. Every Stage 3 primitive that paints with a colour token asserts this.
 *
 * Returns one live render (the dark one, the site default) for further assertions.
 */
import { render, type RenderResult } from '@testing-library/react';
import { expect } from 'vitest';

const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu;

export function renderBothThemes(ui: React.ReactElement): RenderResult {
  document.documentElement.dataset['theme'] = 'light';
  const light = render(ui);
  const lightHtml = light.container.innerHTML;
  light.unmount();

  document.documentElement.dataset['theme'] = 'dark';
  const dark = render(ui);
  const darkHtml = dark.container.innerHTML;

  expect(lightHtml, 'markup must not branch on the theme').toBe(darkHtml);
  expect(darkHtml, 'no literal colour — tokens only').not.toMatch(LITERAL_COLOUR);
  delete document.documentElement.dataset['theme'];
  return dark;
}
