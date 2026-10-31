import type { Funding, Opportunity } from './schemas';

/** Erasmus Mundus note: this is a collection of different Master's programmes,
 * not one individual scholarship. Each programme has its own deadline, country
 * combination and study track.
 */
export const ERASMUS_MUNDUS_NOTE =
  'Erasmus Mundus Joint Masters is a collection of different Master\'s programmes ' +
  'jointly delivered by higher education institutions in at least two European ' +
  'and partner countries. Each programme has its own deadline, scholarship cover ' +
  'and study track.';

/** Plain-language labels shared by every surface that names an opportunity
 * type or a funding coverage, so the same fact never reads two ways on two
 * screens.
 */

/** Opportunity types. */
export const OPPORTUNITY_TYPE_LABEL: Record<Opportunity['type'], string> = {
  research_internship: 'Research internship',
  fellowship: 'Fellowship',
  scholarship: 'Scholarship',
  summer_school: 'Summer school',
  research_program: 'Research programme',
  grant: 'Grant',
  course: 'Course',
  conference: 'Conference',
  other: 'Opportunity',
};

/** Funding coverage labels — only "fully funded" has a complete evidence trail. */
export const FUNDING_COVERAGE_LABEL: Record<Funding['coverage'], string> = {
  fully_funded: 'Fully funded',
  partial: 'Partly funded',
  tuition_only: 'Tuition only',
  unfunded: 'Not funded',
  unknown: 'Funding not confirmed',
};