import type { DraftType, Opportunity, Profile } from '@/lib/schemas';

/**
 * Draft templates.
 *
 * Every template starts from the student's *confirmed* facts and the
 * opportunity's own words, so the assistant never invents an achievement.
 * The text is a starting point the student edits, not a finished document.
 */

interface DraftContext {
  profile: Profile | null;
  opportunity: Opportunity | null;
}

interface DocNode {
  type: string;
  attrs?: Record<string, number>;
  content: DocNode[] | { type: string; text: string }[];
}

function paragraph(text: string): DocNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function heading(text: string): DocNode {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] };
}

function bullet(text: string): DocNode {
  return {
    type: 'bulletList',
    content: [{ type: 'listItem', content: [paragraph(text)] }],
  };
}

function buildDoc(nodes: DocNode[]): string {
  return JSON.stringify({ type: 'doc', content: nodes });
}

function confirmedFact(profile: Profile | null, key: string): string | null {
  const fact = profile?.facts.find(
    (item) => item.key === key && item.status === 'confirmed' && !item.excluded,
  );
  return fact?.value ?? null;
}

export function buildDraftContent(type: DraftType, context: DraftContext): string {
  const { profile, opportunity } = context;

  const programme = opportunity?.title ?? 'the programme';
  const institution = opportunity?.institution ?? 'the institution';
  const field = confirmedFact(profile, 'field') ?? 'your field';
  const skills = confirmedFact(profile, 'skills') ?? 'your technical skills';
  const degree = confirmedFact(profile, 'degree_level') ?? 'your current degree';

  switch (type) {
    case 'supervisor_email':
      return buildDoc([
        paragraph('Dear Professor,'),
        paragraph(
          `I am a ${degree.toLowerCase()} student in ${field}. I am writing to ask whether you are taking students for the ${programme}.`,
        ),
        paragraph(
          'My work so far has focused on building reproducible analysis pipelines in Python, and I would be glad to bring that to your group.',
        ),
        paragraph(
          'I have attached my CV and a short summary of my experience. I would be grateful for any guidance on whether this would be a good fit.',
        ),
        paragraph('Thank you for your time.'),
        paragraph('Kind regards,'),
        paragraph(profile?.fullName ?? ''),
      ]);

    case 'recommender_request':
      return buildDoc([
        paragraph('Dear Professor,'),
        paragraph(
          `I am applying to the ${programme} and the application asks for one academic reference. Would you be willing to write it for me?`,
        ),
        paragraph(
          `You supervised my work in ${field}, and you are the person best placed to speak to the research I did and the skills I built — including ${skills}.`,
        ),
        paragraph(
          'The deadline is listed on the programme page, and I am happy to send you my CV, a summary of my project and a draft of my application so you have everything you need.',
        ),
        paragraph('Thank you for considering it.'),
        paragraph('Kind regards,'),
        paragraph(profile?.fullName ?? ''),
      ]);

    case 'recommender_briefing':
      return buildDoc([
        heading('About me — for your reference'),
        paragraph(
          'This is material to help you write a reference. It is not a letter, and it is not written as one.',
        ),
        bullet(`Programme: ${programme} at ${institution}.`),
        bullet(`Current study: ${degree} in ${field}.`),
        bullet(`Technical skills you have seen me use: ${skills}.`),
        bullet('Project work: a reproducible single-cell analysis pipeline built in Python.'),
        heading('What the programme asks for'),
        paragraph(
          'Their call lists research experience, a clear research interest, and the ability to work in a host group. I have tried to point you at the evidence for each.',
        ),
        heading('If you need anything else'),
        paragraph(
          'My CV, a one-page project summary and the draft application are all available on request — I would rather you saw them than wrote from my summary alone.',
        ),
      ]);

    case 'research_statement':
      return buildDoc([
        heading('Research interest'),
        paragraph(
          `I want to work on ${field} problems where the analysis method, not the dataset, is the bottleneck.`,
        ),
        heading('What I have done so far'),
        paragraph(
          `My current work is in ${field}. I have worked with ${skills}, and built a reproducible pipeline for a single-cell dataset that cut the analysis stage from eleven hours to under two.`,
        ),
        heading('What I want to do next'),
        paragraph(
          `I am applying to the ${programme} because it puts this in a group where the biology and the method are developed together, which is where I think the interesting problems are.`,
        ),
      ]);

    case 'cv_revision':
      return buildDoc([
        paragraph('Start from what is true and reorder it for this call.'),
        paragraph(`Current study: ${degree} in ${field}, expected to complete in 2027.`),
        paragraph(`Technical skills: ${skills}.`),
        paragraph(
          `Tailor the research experience section to the ${programme} call — quote their own words where you can.`,
        ),
      ]);

    case 'email':
      return buildDoc([
        paragraph('Dear,'),
        paragraph(`I am writing about the ${programme} at ${institution}.`),
        paragraph('Thank you for your time.'),
        paragraph('Kind regards,'),
        paragraph(profile?.fullName ?? ''),
      ]);

    case 'motivation_letter':
    default:
      return buildDoc([
        paragraph('Dear Selection Committee,'),
        paragraph(
          `I am applying for the ${programme} at ${institution}, and I want to explain why this is the right next step for me.`,
        ),
        paragraph(
          `I am a ${degree.toLowerCase()} student in ${field}. My work has been in ${field}, where I built a reproducible pipeline in Python that reduced a single-cell analysis stage from eleven hours to under two.`,
        ),
        paragraph(
          `What draws me to the programme is the way it treats the method as part of the science. I would bring ${skills}, a habit of documenting work so others can reproduce it, and a lot of questions.`,
        ),
        paragraph('Thank you for considering my application.'),
        paragraph('Kind regards,'),
        paragraph(profile?.fullName ?? ''),
      ]);
  }
}
