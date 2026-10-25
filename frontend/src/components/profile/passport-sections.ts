/**
 * The sections of the profile passport.
 *
 * This lives apart from the component so the list can be imported without
 * pulling in the component, and so Fast Refresh is not confused by a file
 * that exports both.
 */
export interface PassportSection {
  id: string;
  label: string;
  /** Short label for the mobile chip row. */
  shortLabel: string;
}

export const PASSPORT_SECTIONS: readonly PassportSection[] = [
  { id: 'about', label: 'About me', shortLabel: 'About' },
  { id: 'education', label: 'Education', shortLabel: 'Education' },
  { id: 'experience', label: 'Experience and research', shortLabel: 'Experience' },
  { id: 'skills', label: 'Skills', shortLabel: 'Skills' },
  { id: 'languages', label: 'Languages and certificates', shortLabel: 'Languages' },
  { id: 'preferences', label: 'Destinations and funding', shortLabel: 'Targets' },
  { id: 'documents', label: 'Documents and consent', shortLabel: 'Documents' },
  { id: 'protected', label: 'Protected details', shortLabel: 'Protected' },
  { id: 'history', label: 'Review history', shortLabel: 'History' },
];

/** The visual state of a section, shown as a status dot. */
export type SectionStatus = 'ok' | 'pending' | 'empty';
