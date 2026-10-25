import { describe, expect, it } from 'vitest';
import { reviseSelection } from './revise-selection';
import { getState } from './state';

/**
 * Selection-aware revision.
 *
 * The point of a scoped revision is that only the selection changes. If the
 * rest of the document moves, the student is no longer in control of what
 * they are accepting.
 */

const DOCUMENT = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'I have worked on gene expression for two years. I want to keep doing that.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'The rest of my application is untouched.' }],
    },
  ],
});

function readParagraphs(content: string): string[] {
  const document = JSON.parse(content) as {
    content: { content: { text: string }[] }[];
  };

  return document.content.map((node) => node.content[0]?.text ?? '');
}

describe('reviseSelection', () => {
  it('rewrites only the selected range', () => {
    const state = getState();
    const revised = reviseSelection(
      DOCUMENT,
      'worked on gene expression for two years',
      'Make this more specific',
      state.opportunities[0] ?? null,
      state.profile,
    );

    expect(revised).not.toBeNull();

    const paragraphs = readParagraphs(revised as string);
    const original = readParagraphs(DOCUMENT);

    expect(paragraphs[0]).not.toBe(original[0]);
    expect(paragraphs[1]).toBe(original[1]);
  });

  it('returns null when the selection cannot be found, rather than rewriting everything', () => {
    const state = getState();
    const revised = reviseSelection(
      DOCUMENT,
      'a sentence that is not in the document',
      'Make this more specific',
      state.opportunities[0] ?? null,
      state.profile,
    );

    expect(revised).toBeNull();
  });

  it('returns null for an empty selection', () => {
    expect(reviseSelection(DOCUMENT, '', 'anything', null, null)).toBeNull();
  });

  it('shortens the selection when the instruction asks for it', () => {
    const state = getState();
    const revised = reviseSelection(
      DOCUMENT,
      'I have worked on gene expression for two years. I want to keep doing that.',
      'Make it shorter',
      state.opportunities[0] ?? null,
      state.profile,
    );

    const paragraphs = readParagraphs(revised as string);

    expect(paragraphs[0]).toBe('I have worked on gene expression for two years.');
    expect(paragraphs[1]).toBe('The rest of my application is untouched.');
  });
});
