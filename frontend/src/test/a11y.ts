import axe from 'axe-core';
import { act } from 'react';

/**
 * Accessibility gate.
 *
 * Colour contrast is skipped because jsdom performs no layout, so contrast
 * cannot be measured reliably here. It is verified manually in the browser
 * and by inspection of the token palette.
 */
export async function findAccessibilityViolations(container: HTMLElement): Promise<axe.Result[]> {
  let results: axe.AxeResults | undefined;

  // The scan runs inside `act` so that queries still settling do not update
  // the tree while the scan is in progress.
  await act(async () => {
    results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
  });

  return (results?.violations ?? []).filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
}

export function describeViolations(violations: axe.Result[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    )
    .join('\n');
}
