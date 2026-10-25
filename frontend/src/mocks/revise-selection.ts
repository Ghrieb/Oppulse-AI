import type { Opportunity, Profile } from '@/lib/schemas';

/**
 * Selection-aware revision.
 *
 * The mock rewrites only the text the student selected, so the rest of the
 * document is untouched. The mechanism matters more than the prose: it is
 * what makes a scoped revision safe to accept.
 */

interface TextNode {
  type: string;
  text?: string;
  content?: TextNode[];
}

function confirmedFact(profile: Profile | null, key: string): string | null {
  const fact = profile?.facts.find(
    (item) => item.key === key && item.status === 'confirmed' && !item.excluded,
  );
  return fact?.value ?? null;
}

function rewriteText(
  selected: string,
  instruction: string,
  opportunity: Opportunity | null,
  profile: Profile | null,
): string {
  const programme = opportunity?.title ?? 'the programme';
  const field = confirmedFact(profile, 'field') ?? 'my field';

  if (/short|concise|brief|tighter/i.test(instruction)) {
    const firstSentence = selected.split(/(?<=\.)\s+/)[0] ?? selected;
    return firstSentence;
  }

  if (/specific|host|programme|program/i.test(instruction)) {
    return `${selected} I want to build on this in the ${programme}, where the work in ${field} is exactly what I want to keep doing.`;
  }

  return `${selected} This is the part I would make more concrete before I send it.`;
}

function replaceInNode(node: TextNode, selected: string, replacement: string): boolean {
  if (typeof node.text === 'string' && node.text.includes(selected)) {
    node.text = node.text.replace(selected, replacement);
    return true;
  }

  for (const child of node.content ?? []) {
    if (replaceInNode(child, selected, replacement)) return true;
  }

  return false;
}

/**
 * Returns a new document with only the selected range rewritten, or `null`
 * when the selection cannot be located (in which case the caller must not
 * silently rewrite the whole document).
 */
export function reviseSelection(
  content: string,
  selectedText: string,
  instruction: string,
  opportunity: Opportunity | null,
  profile: Profile | null,
): string | null {
  if (!selectedText) return null;

  let document: { type?: string; content?: TextNode[] };
  try {
    document = JSON.parse(content) as { type?: string; content?: TextNode[] };
  } catch {
    return null;
  }

  const replacement = rewriteText(selectedText, instruction, opportunity, profile);
  let replaced = false;

  for (const node of document.content ?? []) {
    if (replaceInNode(node, selectedText, replacement)) {
      replaced = true;
      break;
    }
  }

  if (!replaced) return null;

  return JSON.stringify(document);
}
