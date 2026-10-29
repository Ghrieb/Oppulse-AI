import type { Funding, Opportunity } from './schemas';

/**
 * Plain-language labels shared by every surface that names an opportunity
 * type or a funding coverage, so the same fact never reads two ways on two
 * screens.
 */
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

export const FUNDING_COVERAGE_LABEL: Record<Funding['coverage'], string> = {
  fully_funded: 'Fully funded',
  partial: 'Partly funded',
  tuition_only: 'Tuition only',
  unfunded: 'Not funded',
  unknown: 'Funding not confirmed',
};
