import type {
  CountryIdentity,
  Evidence,
  InstitutionBrand,
  Match,
  Opportunity,
  Requirement,
  Source,
} from '@/lib/schemas';
import { withRules } from './requirement-rules';

/** An opportunity before the rule table is applied to its requirements. */
type RawOpportunity = Omit<Opportunity, 'requirements'> & {
  requirements: Omit<Requirement, 'check' | 'blocking' | 'ageRule'>[];
};

/**
 * Opportunity fixtures.
 *
 * These deliberately include the imperfections the real backend produces:
 * a conflicting deadline, an unreachable source, unresolved eligibility,
 * unknown competitiveness, and unverified funding. If the interface only
 * looks correct with perfect data, it is not finished.
 */

/** Country or region identity. Regions have no flag, only a badge. */
function country(
  iso2: string,
  name: string,
  region: string | null,
  kind: CountryIdentity['kind'] = 'country',
): CountryIdentity {
  return { iso2, name, kind, region };
}

/**
 * Institution brand.
 *
 * `logoUrl` is only ever a URL the backend has validated and cached. In the
 * prototype the assets are local, clearly synthetic wordmarks; one entry
 * deliberately points at a missing file so the fallback is exercised.
 */
function brand(
  institutionName: string,
  officialDomain: string,
  options: {
    logoUrl?: string | null;
    bannerUrl?: string | null;
    source?: InstitutionBrand['source'];
    iconSource?: InstitutionBrand['iconSource'];
  } = {},
): InstitutionBrand {
  const hasRealAsset = Boolean(options.logoUrl ?? options.bannerUrl);

  return {
    institutionName,
    officialDomain,
    logoUrl: options.logoUrl ?? null,
    bannerUrl: options.bannerUrl ?? null,
    attribution: options.logoUrl ? 'Sample illustration' : null,
    verifiedAt: '2026-10-18T21:10:00.000Z',
    source: options.source ?? 'fallback',
    // A synthetic institution is never looked up on a third-party service.
    generated: !hasRealAsset,
    iconSource: options.iconSource ?? 'none',
  };
}

export const DEMO_SOURCES: Source[] = [
  {
    id: 'e5000000-0000-4000-8000-000000000001',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://helios-fellowship.org/programmes/computational-biology',
    title: 'Helios Research Fellowship — Computational Biology',
    domain: 'helios-fellowship.org',
    excerpt:
      'The Helios Fellowship funds 12-month placements in computational biology and genomics research groups. Full funding covers a living allowance, travel and insurance. Applicants must be enrolled in a Master’s or PhD programme.',
    quality: 'official',
    status: 'retrieved',
    contentHash: 'sha256:9f2c14be77a0',
    retrievedAt: '2026-10-18T21:12:04.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000002',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://europe-fellowships.eu/listings/helios-computational-biology',
    title: 'Helios Computational Biology Fellowship — listing',
    domain: 'europe-fellowships.eu',
    excerpt:
      'Helios Fellowship: EUR 2,400/month, 24 month placements, open to applicants from DAC countries. Deadline listed as 20 November 2026.',
    quality: 'aggregator',
    status: 'retrieved',
    contentHash: 'sha256:41bd0c9ae2f1',
    retrievedAt: '2026-10-18T21:13:10.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000003',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://meridian-ai.eu/summer-school',
    title: 'Meridian AI Summer School 2027',
    domain: 'meridian-ai.eu',
    excerpt:
      'Six-week summer school on machine learning for the life sciences. Tuition is covered; travel and accommodation are not included in the scholarship. Application deadline 5 December 2026.',
    quality: 'official',
    status: 'retrieved',
    contentHash: 'sha256:7c0e5a3b9d44',
    retrievedAt: '2026-10-18T21:14:22.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000004',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://atlas-scholarship.ca/graduate/2027',
    title: 'Atlas Global Graduate Scholarship — 2027 cohort',
    domain: 'atlas-scholarship.ca',
    excerpt:
      'Full funding for graduate study in Canada: tuition, living stipend and health coverage. Approximately 400 awards annually. Deadline for the 2027 cohort is 28 November 2026.',
    quality: 'official',
    status: 'retrieved',
    contentHash: 'sha256:1de7b8f0aa62',
    retrievedAt: '2026-10-18T21:15:35.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000005',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://rivermouth.edu/research/internships',
    title: 'Rivermouth Institute — Research Internships',
    domain: 'rivermouth.edu',
    excerpt:
      'Ten-week research internships for graduate students. The institute provides a stipend of USD 3,500 for the period; tuition is not applicable. Applications for the 2027 cycle close 15 January 2027.',
    quality: 'official',
    status: 'retrieved',
    contentHash: 'sha256:5b3c9d21e7a0',
    retrievedAt: '2026-10-18T21:16:48.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000006',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://sable-foundation.org/fellowships/2027',
    title: 'Sable Foundation Fellowship 2027',
    domain: 'sable-foundation.org',
    excerpt:
      'Fellowships for early-career researchers in public-health genomics. The foundation states that awards are limited to nationals of countries on its restricted list, published in a separate annex. The 2027 call has not published a deadline.',
    quality: 'official',
    status: 'retrieved',
    contentHash: 'sha256:8a2f60c4e913',
    retrievedAt: '2026-10-18T21:17:55.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000007',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://verdant-fellowship.eu/calls/climate-data',
    title: 'Verdant Climate Data Fellowship',
    domain: 'verdant-fellowship.eu',
    excerpt:
      'Two-year fellowship using machine learning for climate datasets. Covers salary, travel and equipment. Applications close 1 December 2026 at 23:59 CET.',
    quality: 'official',
    status: 'retrieved',
    contentHash: 'sha256:3d7c1b8e4409',
    retrievedAt: '2026-10-18T21:19:03.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000008',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://verdant-partners.org/programmes/climate-data-fellowship',
    title: 'Verdant Climate Data Fellowship — partner listing',
    domain: 'verdant-partners.org',
    excerpt:
      'Partner listing stating that applications for the Climate Data Fellowship close 8 December 2026 and that the fellowship runs for 18 months.',
    quality: 'secondary',
    status: 'retrieved',
    contentHash: 'sha256:6e0a93c7b2d1',
    retrievedAt: '2026-10-18T21:20:11.000Z',
    pageReference: null,
    failureReason: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000009',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://northwind-program.org/summer-research',
    title: 'Northwind Summer Research Programme',
    domain: 'northwind-program.org',
    excerpt: '',
    quality: 'unknown',
    status: 'unavailable',
    contentHash: '',
    retrievedAt: '2026-10-18T21:21:40.000Z',
    pageReference: null,
    failureReason:
      'The site did not respond within 15 seconds and returned no usable content. No claim from this source is marked as verified.',
  },
  {
    id: 'e5000000-0000-4000-8000-000000000010',
    runId: '2c000000-0000-4000-8000-000000000001',
    url: 'https://research-grants-index.org/listing/meridian-ai-2027',
    title: 'Meridian AI Summer School — index listing',
    domain: 'research-grants-index.org',
    excerpt:
      'Meridian AI Summer School 2027. Six weeks. Tuition covered. Not open to applicants who require a visa sponsor, as the programme is delivered in person.',
    quality: 'aggregator',
    status: 'retrieved',
    contentHash: 'sha256:c4b81d0f2e57',
    retrievedAt: '2026-10-18T21:22:58.000Z',
    pageReference: null,
    failureReason: null,
  },
];

const RAW_OPPORTUNITIES: RawOpportunity[] = [
  {
    id: 'd4000000-0000-4000-8000-000000000001',
    title: 'Helios Research Fellowship in Computational Biology',
    institution: 'Helios Institute for Applied Genomics',
    type: 'fellowship',
    country: country('NL', 'Netherlands', 'Europe'),
    sourceDomain: 'helios-fellowship.org',
    canonicalUrl: 'https://helios-fellowship.org/programmes/computational-biology',
    summary:
      'A 12-month funded placement in a computational biology research group, covering a living allowance, travel and insurance. Open to Master’s and PhD students.',
    institutionBrand: brand('Helios Institute for Applied Genomics', 'helios-fellowship.org', {
      logoUrl: '/demo-assets/helios-logo.svg',
      bannerUrl: '/demo-assets/helios-banner.svg',
      source: 'provider',
    }),
    duration: '12 months',
    applicationOpensAt: '2026-08-15',
    tags: ['Computational biology', 'Fully funded', 'Europe'],
    deadline: {
      value: '2026-11-20',
      timezone: 'Europe/Amsterdam',
      status: 'verified',
      remainingDays: 32,
      evidenceId: 'f6000000-0000-4000-8000-000000000001',
      conflicts: [],
      note: 'Confirmed on the official programme page and a second independent listing.',
    },
    additionalDeadlines: [
      {
        id: '91000000-0000-4000-8000-000000000001',
        stage: 'applications_open',
        value: '2026-08-15',
        timezone: 'Europe/Amsterdam',
        status: 'verified',
        remainingDays: null,
        evidenceId: 'f6000000-0000-4000-8000-000000000001',
        label: 'Applications open',
      },
    ],
    funding: {
      coverage: 'fully_funded',
      components: [
        {
          label: 'Living allowance',
          status: 'confirmed',
          amount: 'EUR 2,400 / month',
          currency: 'EUR',
          evidenceId: 'f6000000-0000-4000-8000-000000000002',
          note: null,
        },
        {
          label: 'Travel',
          status: 'confirmed',
          amount: 'Up to EUR 1,500',
          currency: 'EUR',
          evidenceId: 'f6000000-0000-4000-8000-000000000002',
          note: null,
        },
        {
          label: 'Insurance',
          status: 'confirmed',
          amount: null,
          currency: null,
          evidenceId: 'f6000000-0000-4000-8000-000000000001',
          note: null,
        },
        {
          label: 'Tuition',
          status: 'not_covered',
          amount: null,
          currency: null,
          evidenceId: null,
          note: 'Not applicable — this is a research placement, not a degree programme.',
        },
      ],
      estimatedGap: null,
      note: 'Every funded component is supported by the official call.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000001',
        label: 'Enrolled in a Master’s or PhD programme',
        kind: 'degree',
        status: 'likely',
        sourceClause:
          'Applicants must be enrolled in a Master’s or PhD programme in a relevant discipline at the time of application.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000001'],
        profileFactKey: 'degree_level',
        explanation:
          'Your confirmed profile records a second-year Master’s student in computational biology, which satisfies this requirement.',
      },
      {
        id: '50000000-0000-4000-8000-000000000002',
        label: 'Field alignment with computational biology or genomics',
        kind: 'field',
        status: 'likely',
        sourceClause:
          'The placement must sit within a computational biology or genomics research group.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000001'],
        profileFactKey: 'field',
        explanation:
          'Your degree is in Computational Biology and Bioinformatics, which maps directly onto the eligible research groups.',
      },
      {
        id: '50000000-0000-4000-8000-000000000003',
        label: 'Open to applicants from DAC countries',
        kind: 'nationality',
        status: 'likely',
        sourceClause: 'The fellowship is open to applicants from DAC-list countries.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000002'],
        profileFactKey: 'nationality',
        explanation:
          'Algeria is on the DAC list referenced by the listing, so the nationality clause is satisfied. This is checked against the listing, not the primary call.',
      },
      {
        id: '50000000-0000-4000-8000-000000000004',
        label: 'English proficiency',
        kind: 'language',
        status: 'unresolved',
        sourceClause: 'A minimum of B2 English is required for the research group.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000001'],
        profileFactKey: 'english_level',
        explanation:
          'Your IELTS score was extracted from a document but is still awaiting your confirmation, so this requirement cannot be marked as met yet.',
      },
    ],
    saved: true,
    dismissed: false,
    createdAt: '2026-10-18T21:24:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000002',
    title: 'Meridian AI Summer School 2027',
    institution: 'Meridian Institute',
    type: 'summer_school',
    country: country('NL', 'Netherlands', 'Europe'),
    sourceDomain: 'meridian-ai.eu',
    canonicalUrl: 'https://meridian-ai.eu/summer-school',
    summary:
      'A six-week summer school on machine learning applied to the life sciences. Tuition is covered; travel and accommodation are not part of the scholarship.',
    institutionBrand: brand('Meridian Institute', 'meridian-ai.eu'),
    duration: '6 weeks',
    applicationOpensAt: '2026-09-01',
    tags: ['AI', 'Summer school', 'Tuition covered'],
    deadline: {
      value: '2026-12-05',
      timezone: 'Europe/Amsterdam',
      status: 'verified',
      remainingDays: 47,
      evidenceId: 'f6000000-0000-4000-8000-000000000003',
      conflicts: [],
      note: 'Stated on the official programme page.',
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'partial',
      components: [
        {
          label: 'Tuition',
          status: 'confirmed',
          amount: 'EUR 4,800',
          currency: 'EUR',
          evidenceId: 'f6000000-0000-4000-8000-000000000003',
          note: null,
        },
        {
          label: 'Travel',
          status: 'not_covered',
          amount: null,
          currency: null,
          evidenceId: 'f6000000-0000-4000-8000-000000000003',
          note: 'Flights and local transport are not covered.',
        },
        {
          label: 'Accommodation',
          status: 'not_covered',
          amount: null,
          currency: null,
          evidenceId: 'f6000000-0000-4000-8000-000000000003',
          note: 'Participants arrange their own housing.',
        },
      ],
      estimatedGap: {
        amount: 1850,
        currency: 'EUR',
        basis:
          'Indicative return flight from Algiers plus six weeks of shared accommodation, taken from the programme’s own cost guidance and the published tuition figure.',
      },
      note: 'Tuition is covered. Travel and housing remain your cost.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000005',
        label: 'Graduate or final-year undergraduate student',
        kind: 'degree',
        status: 'likely',
        sourceClause: 'Open to graduate students and final-year undergraduates.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000003'],
        profileFactKey: 'degree_level',
        explanation: 'Your Master’s enrolment meets this requirement.',
      },
      {
        id: '50000000-0000-4000-8000-000000000006',
        label: 'Programme requires a visa sponsor',
        kind: 'other',
        status: 'likely',
        sourceClause:
          'The programme is delivered in person and does not sponsor visas for participants who require one.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000004'],
        profileFactKey: 'nationality',
        explanation:
          'The published restriction is that applicants who need a visa sponsor are not accepted. Your profile does not record visa status, so confirm yours before applying.',
      },
      {
        id: '50000000-0000-4000-8000-000000000017',
        label: 'Participants must be 18 or over at the start of the programme',
        kind: 'age',
        status: 'unresolved',
        sourceClause: 'The summer school is open to participants aged 18 and over.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000003'],
        profileFactKey: null,
        explanation:
          'Your date of birth is not available, so this age requirement stays unresolved. You can add it in your passport.',
      },
    ],
    saved: false,
    dismissed: false,
    createdAt: '2026-10-18T21:25:20.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000003',
    title: 'Atlas Global Graduate Scholarship — 2027 cohort',
    institution: 'Atlas Foundation',
    type: 'scholarship',
    country: country('CA', 'Canada', 'North America'),
    sourceDomain: 'atlas-scholarship.ca',
    canonicalUrl: 'https://atlas-scholarship.ca/graduate/2027',
    summary:
      'Full funding for graduate study in Canada, including tuition, a living stipend and health coverage. Around 400 awards are made each year.',
    institutionBrand: brand('Atlas Foundation', 'atlas-scholarship.ca', {
      logoUrl: '/demo-assets/missing-logo.svg',
      source: 'provider',
    }),
    duration: '1–2 years',
    applicationOpensAt: '2026-08-01',
    tags: ['Scholarship', 'Fully funded', 'Graduate'],
    deadline: {
      value: '2026-11-28',
      timezone: 'America/Toronto',
      status: 'verified',
      remainingDays: 40,
      evidenceId: 'f6000000-0000-4000-8000-000000000004',
      conflicts: [],
      note: 'Published on the official cohort page.',
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'fully_funded',
      components: [
        {
          label: 'Tuition',
          status: 'confirmed',
          amount: 'Full tuition',
          currency: 'CAD',
          evidenceId: 'f6000000-0000-4000-8000-000000000004',
          note: null,
        },
        {
          label: 'Living stipend',
          status: 'confirmed',
          amount: 'CAD 1,800 / month',
          currency: 'CAD',
          evidenceId: 'f6000000-0000-4000-8000-000000000004',
          note: null,
        },
        {
          label: 'Health coverage',
          status: 'confirmed',
          amount: null,
          currency: null,
          evidenceId: 'f6000000-0000-4000-8000-000000000004',
          note: null,
        },
      ],
      estimatedGap: null,
      note: 'All components are covered, subject to maintaining satisfactory academic standing.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000007',
        label: 'Admission to a participating Canadian programme',
        kind: 'other',
        status: 'unresolved',
        sourceClause:
          'Applicants must hold or receive an admission offer from a participating Canadian institution.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000004'],
        profileFactKey: null,
        explanation:
          'This depends on a university offer you have not applied for yet, so it cannot be resolved from your profile alone.',
      },
      {
        id: '50000000-0000-4000-8000-000000000008',
        label: 'English proficiency',
        kind: 'language',
        status: 'unresolved',
        sourceClause: 'Minimum test scores are specified by the admitting institution.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000004'],
        profileFactKey: 'english_level',
        explanation:
          'Your IELTS result is still awaiting confirmation, and the required score varies by institution.',
      },
      {
        id: '50000000-0000-4000-8000-000000000009',
        label: 'No nationality restriction',
        kind: 'nationality',
        status: 'not_applicable',
        sourceClause: 'The scholarship is open to all nationalities.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000004'],
        profileFactKey: 'nationality',
        explanation: 'There is no nationality restriction for this award.',
      },
    ],
    saved: true,
    dismissed: false,
    createdAt: '2026-10-18T21:26:41.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000004',
    title: 'Rivermouth Institute Research Internship',
    institution: 'Rivermouth Institute',
    type: 'research_internship',
    country: country('US', 'United States', 'North America'),
    sourceDomain: 'rivermouth.edu',
    canonicalUrl: 'https://rivermouth.edu/research/internships',
    summary:
      'Ten-week research internships for graduate students, with a stipend of USD 3,500 for the full period.',
    institutionBrand: brand('Rivermouth Institute', 'rivermouth.edu'),
    duration: '10 weeks',
    applicationOpensAt: '2026-09-15',
    tags: ['Research internship', 'Stipend'],
    deadline: {
      value: '2027-01-15',
      timezone: 'America/New_York',
      status: 'verified',
      remainingDays: 88,
      evidenceId: 'f6000000-0000-4000-8000-000000000005',
      conflicts: [],
      note: 'Published on the internship page.',
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'partial',
      components: [
        {
          label: 'Stipend',
          status: 'confirmed',
          amount: 'USD 3,500 total',
          currency: 'USD',
          evidenceId: 'f6000000-0000-4000-8000-000000000005',
          note: null,
        },
        {
          label: 'Travel and housing',
          status: 'not_covered',
          amount: null,
          currency: null,
          evidenceId: 'f6000000-0000-4000-8000-000000000005',
          note: 'The institute states that travel and accommodation are the participant’s responsibility.',
        },
      ],
      estimatedGap: {
        amount: 3200,
        currency: 'USD',
        basis:
          'Round-trip economy airfare from Algiers to the host city plus eight weeks of housing, based on the published stipend as the only confirmed amount.',
      },
      note: 'A stipend is provided, but the programme is not fully funded.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000010',
        label: 'Graduate student enrolment',
        kind: 'degree',
        status: 'likely',
        sourceClause: 'Enrolled in a graduate degree programme.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000005'],
        profileFactKey: 'degree_level',
        explanation: 'Your Master’s enrolment meets this requirement.',
      },
      {
        id: '50000000-0000-4000-8000-000000000011',
        label: 'Work authorisation for the host country',
        kind: 'other',
        status: 'unresolved',
        sourceClause:
          'Participants must be able to work in the United States for the duration of the internship.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000005'],
        profileFactKey: null,
        explanation:
          'Your profile does not record visa or work-authorisation status, and the call does not state whether sponsorship is available.',
      },
    ],
    saved: false,
    dismissed: false,
    createdAt: '2026-10-18T21:27:55.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000005',
    title: 'Sable Foundation Fellowship 2027',
    institution: 'Sable Foundation',
    type: 'fellowship',
    country: country('XU', 'Europe and Africa', 'Multiple regions', 'region'),
    sourceDomain: 'sable-foundation.org',
    canonicalUrl: 'https://sable-foundation.org/fellowships/2027',
    summary:
      'Fellowships in public-health genomics for early-career researchers. Awards are restricted to nationals of countries on a list published in a separate annex.',
    institutionBrand: brand('Sable Foundation', 'sable-foundation.org'),
    duration: '12 months',
    applicationOpensAt: null,
    tags: ['Fellowship', 'Public health', 'Funding unclear'],
    deadline: {
      value: null,
      timezone: null,
      status: 'not_found',
      remainingDays: null,
      evidenceId: null,
      conflicts: [],
      note: 'The 2027 call has not published a deadline. The page states that dates will be announced in December 2026.',
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'unknown',
      components: [
        {
          label: 'Award amount',
          status: 'unknown',
          amount: null,
          currency: null,
          evidenceId: null,
          note: 'The call does not state the amount on the page we retrieved.',
        },
      ],
      estimatedGap: null,
      note: 'We could not determine what this fellowship pays from the sources we reached.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000012',
        label: 'Nationality restricted to a published annex list',
        kind: 'nationality',
        status: 'unresolved',
        sourceClause:
          'Awards are limited to nationals of countries listed in Annex A, which is distributed separately and is not reproduced on this page.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000006'],
        profileFactKey: 'nationality',
        explanation:
          'The annex containing the eligible-country list was not published on the page we could reach, so we cannot confirm whether Algeria is included. This is the single most important thing to verify before spending time here.',
      },
      {
        id: '50000000-0000-4000-8000-000000000013',
        label: 'Early-career researcher in genomics',
        kind: 'field',
        status: 'likely',
        sourceClause: 'Applicants must be early-career researchers working in genomics.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000006'],
        profileFactKey: 'field',
        explanation: 'Your computational biology background is closely aligned with the call.',
      },
      {
        id: '50000000-0000-4000-8000-000000000018',
        label: 'Applicants must be under 30 on the closing date',
        kind: 'age',
        status: 'unresolved',
        sourceClause: 'The fellowship is open to applicants under 30 at the closing date.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000006'],
        profileFactKey: null,
        explanation:
          'Two sources state different age rules, so this one needs your review. The rule from the official call is shown here.',
      },
    ],
    saved: false,
    dismissed: false,
    createdAt: '2026-10-18T21:29:10.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000006',
    title: 'Verdant Climate Data Fellowship',
    institution: 'Verdant Research Network',
    type: 'fellowship',
    country: country('BE', 'Belgium', 'Europe'),
    sourceDomain: 'verdant-fellowship.eu',
    canonicalUrl: 'https://verdant-fellowship.eu/calls/climate-data',
    summary:
      'A two-year fellowship applying machine learning to climate datasets, covering salary, travel and equipment.',
    institutionBrand: brand('Verdant Research Network', 'verdant-fellowship.eu', {
      bannerUrl: '/demo-assets/verdant-banner.svg',
      source: 'provider',
    }),
    duration: '24 months',
    applicationOpensAt: '2026-09-20',
    tags: ['Climate', 'Machine learning', 'Fully funded'],
    deadline: {
      value: '2026-12-01',
      timezone: 'Europe/Brussels',
      status: 'conflict',
      remainingDays: null,
      evidenceId: 'f6000000-0000-4000-8000-000000000007',
      conflicts: [
        {
          value: '2026-12-08',
          url: 'https://verdant-partners.org/programmes/climate-data-fellowship',
          retrievedAt: '2026-10-18T21:20:11.000Z',
          sourceId: 'e5000000-0000-4000-8000-000000000008',
        },
      ],
      note: 'Two sources show different closing dates. We have not marked this deadline as safe — check the official call before relying on it.',
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'fully_funded',
      components: [
        {
          label: 'Salary',
          status: 'confirmed',
          amount: 'EUR 3,100 / month',
          currency: 'EUR',
          evidenceId: 'f6000000-0000-4000-8000-000000000007',
          note: null,
        },
        {
          label: 'Travel and equipment budget',
          status: 'confirmed',
          amount: 'EUR 4,000 total',
          currency: 'EUR',
          evidenceId: 'f6000000-0000-4000-8000-000000000007',
          note: null,
        },
      ],
      estimatedGap: null,
      note: 'Funding is fully covered by the official call.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000014',
        label: 'Master’s degree completed or in progress',
        kind: 'degree',
        status: 'likely',
        sourceClause: 'A completed Master’s degree, or enrolment in a relevant Master’s programme.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000007'],
        profileFactKey: 'degree_level',
        explanation: 'Your current Master’s enrolment satisfies this requirement.',
      },
      {
        id: '50000000-0000-4000-8000-000000000015',
        label: 'Experience with machine learning on large datasets',
        kind: 'field',
        status: 'likely',
        sourceClause: 'Demonstrated experience applying machine learning to large datasets.',
        evidenceIds: ['f6000000-0000-4000-8000-000000000007'],
        profileFactKey: 'skills',
        explanation:
          'Your confirmed skills include PyTorch and Python, which the call names directly.',
      },
    ],
    saved: false,
    dismissed: false,
    createdAt: '2026-10-18T21:30:26.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000007',
    title: 'Northwind Summer Research Programme',
    institution: 'Northwind Research Network',
    type: 'research_program',
    country: country('CA', 'Canada', 'North America'),
    sourceDomain: 'northwind-program.org',
    canonicalUrl: 'https://northwind-program.org/summer-research',
    summary:
      'An eight-week summer research programme. We found the announcement but could not open the official page, so nothing about this programme is verified yet.',
    institutionBrand: brand('Northwind Research Network', 'northwind-program.org'),
    duration: '8 weeks',
    applicationOpensAt: null,
    tags: ['Summer research', 'Unverified'],
    deadline: {
      value: null,
      timezone: null,
      status: 'not_found',
      remainingDays: null,
      evidenceId: null,
      conflicts: [],
      note: 'The official page could not be reached. No deadline has been verified for this programme.',
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'unknown',
      components: [],
      estimatedGap: null,
      note: 'Funding details are unknown because the source could not be retrieved.',
    },
    requirements: [
      {
        id: '50000000-0000-4000-8000-000000000016',
        label: 'Requirements not yet known',
        kind: 'other',
        status: 'unresolved',
        sourceClause: null,
        evidenceIds: [],
        profileFactKey: null,
        explanation:
          'We could not open the official announcement, so the requirements have not been extracted. Open the official page or upload the announcement PDF to complete this analysis.',
      },
    ],
    saved: false,
    dismissed: false,
    createdAt: '2026-10-18T21:31:44.000Z',
  },
];

/** The opportunities, with their eligibility rules attached. */
export const DEMO_OPPORTUNITIES: Opportunity[] = RAW_OPPORTUNITIES.map(withRules);

export const DEMO_EVIDENCE: Evidence[] = [
  {
    id: 'f6000000-0000-4000-8000-000000000001',
    sourceId: 'e5000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000001',
    claim:
      'Applications close on 20 November 2026 and the fellowship covers a living allowance, travel and insurance.',
    excerpt:
      'Applications must be received by 20 November 2026, 23:59 CET. The fellowship covers a monthly living allowance, round-trip travel and health insurance for the full placement.',
    pageReference: null,
    url: 'https://helios-fellowship.org/programmes/computational-biology',
    retrievedAt: '2026-10-18T21:12:04.000Z',
    quality: 'official',
    stance: 'supports',
    confidence: 'high',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000002',
    sourceId: 'e5000000-0000-4000-8000-000000000002',
    opportunityId: 'd4000000-0000-4000-8000-000000000001',
    claim:
      'The living allowance is EUR 2,400 per month and the fellowship is open to DAC-list nationalities.',
    excerpt:
      'Helios Fellowship: EUR 2,400/month, 24 month placements, open to applicants from DAC countries. Deadline listed as 20 November 2026.',
    pageReference: null,
    url: 'https://europe-fellowships.eu/listings/helios-computational-biology',
    retrievedAt: '2026-10-18T21:13:10.000Z',
    quality: 'aggregator',
    stance: 'supports',
    confidence: 'medium',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000003',
    sourceId: 'e5000000-0000-4000-8000-000000000003',
    opportunityId: 'd4000000-0000-4000-8000-000000000002',
    claim: 'Tuition is covered but travel and accommodation are not part of the scholarship.',
    excerpt:
      'Tuition is fully covered for all admitted participants. Travel, accommodation and living costs are not covered by the scholarship.',
    pageReference: null,
    url: 'https://meridian-ai.eu/summer-school',
    retrievedAt: '2026-10-18T21:14:22.000Z',
    quality: 'official',
    stance: 'supports',
    confidence: 'high',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000004',
    sourceId: 'e5000000-0000-4000-8000-000000000010',
    opportunityId: 'd4000000-0000-4000-8000-000000000002',
    claim: 'The programme does not sponsor visas for participants who need one.',
    excerpt:
      'Not open to applicants who require a visa sponsor, as the programme is delivered in person.',
    pageReference: null,
    url: 'https://research-grants-index.org/listing/meridian-ai-2027',
    retrievedAt: '2026-10-18T21:22:58.000Z',
    quality: 'aggregator',
    stance: 'supports',
    confidence: 'medium',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000005',
    sourceId: 'e5000000-0000-4000-8000-000000000004',
    opportunityId: 'd4000000-0000-4000-8000-000000000003',
    claim:
      'The 2027 cohort closes on 28 November 2026 and covers tuition, a stipend and health coverage.',
    excerpt:
      'Full funding for graduate study in Canada: tuition, living stipend and health coverage. Approximately 400 awards annually. Deadline for the 2027 cohort is 28 November 2026.',
    pageReference: null,
    url: 'https://atlas-scholarship.ca/graduate/2027',
    retrievedAt: '2026-10-18T21:15:35.000Z',
    quality: 'official',
    stance: 'supports',
    confidence: 'high',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000006',
    sourceId: 'e5000000-0000-4000-8000-000000000005',
    opportunityId: 'd4000000-0000-4000-8000-000000000004',
    claim: 'The internship provides a USD 3,500 stipend but not travel or housing.',
    excerpt:
      'Ten-week research internships for graduate students. The institute provides a stipend of USD 3,500 for the period; tuition is not applicable.',
    pageReference: null,
    url: 'https://rivermouth.edu/research/internships',
    retrievedAt: '2026-10-18T21:16:48.000Z',
    quality: 'official',
    stance: 'supports',
    confidence: 'high',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000007',
    sourceId: 'e5000000-0000-4000-8000-000000000006',
    opportunityId: 'd4000000-0000-4000-8000-000000000005',
    claim:
      'The eligible-country list is published in a separate annex that is not on the call page.',
    excerpt:
      'Awards are limited to nationals of countries on the restricted list published in Annex A. Annex A is issued separately to registered applicants.',
    pageReference: 'Section 3',
    url: 'https://sable-foundation.org/fellowships/2027',
    retrievedAt: '2026-10-18T21:17:55.000Z',
    quality: 'official',
    stance: 'supports',
    confidence: 'high',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000008',
    sourceId: 'e5000000-0000-4000-8000-000000000007',
    opportunityId: 'd4000000-0000-4000-8000-000000000006',
    claim: 'The official call states the closing date is 1 December 2026.',
    excerpt:
      'Applications close 1 December 2026 at 23:59 CET. The fellowship runs for two years and covers salary, travel and equipment.',
    pageReference: null,
    url: 'https://verdant-fellowship.eu/calls/climate-data',
    retrievedAt: '2026-10-18T21:19:03.000Z',
    quality: 'official',
    stance: 'supports',
    confidence: 'high',
  },
  {
    id: 'f6000000-0000-4000-8000-000000000009',
    sourceId: 'e5000000-0000-4000-8000-000000000008',
    opportunityId: 'd4000000-0000-4000-8000-000000000006',
    claim: 'A partner listing states the closing date is 8 December 2026.',
    excerpt:
      'Partner listing stating that applications for the Climate Data Fellowship close 8 December 2026 and that the fellowship runs for 18 months.',
    pageReference: null,
    url: 'https://verdant-partners.org/programmes/climate-data-fellowship',
    retrievedAt: '2026-10-18T21:20:11.000Z',
    quality: 'secondary',
    stance: 'contradicts',
    confidence: 'medium',
  },
];

export const DEMO_MATCHES: Match[] = [
  {
    id: '0a000000-0000-4000-8000-000000000001',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000001',
    fitScore: 92,
    fitLabel: 'Excellent profile match',
    eligibility: 'likely',
    competitiveness: 'moderate',
    confidence: 'high',
    reasons: [
      'Your degree in Computational Biology and Bioinformatics matches the eligible research groups exactly.',
      'You are enrolled in a Master’s programme, which the fellowship requires.',
      'Algeria is on the DAC list referenced by the listing, so the nationality clause is satisfied.',
      'The funding covers a living allowance, travel and insurance, with no gap we could identify.',
    ],
    warnings: [
      'Your IELTS result is still unconfirmed, so the English requirement cannot be marked as met.',
    ],
    recommendation:
      'Strong fit and fully funded. Confirm your English score, then prepare the two-page research proposal this fellowship asks for.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:24:05.000Z',
  },
  {
    id: '0a000000-0000-4000-8000-000000000002',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000003',
    fitScore: 78,
    fitLabel: 'Good profile match',
    eligibility: 'likely',
    competitiveness: 'unknown',
    confidence: 'medium',
    reasons: [
      'The programme is built for graduate students applying machine learning to biology, which matches your skills.',
      'Tuition is covered, so the main cost is travel and housing.',
    ],
    warnings: [
      'We found no acceptance or selectivity figures, so competitiveness is unknown rather than assumed.',
      'The listing says applicants who need a visa sponsor are not accepted. Check your visa position before applying.',
    ],
    recommendation:
      'Worth considering if your visa position allows travel. Confirm the visa condition and price the travel gap before committing.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:25:25.000Z',
  },
  {
    id: '0a000000-0000-4000-8000-000000000003',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000003',
    fitScore: 85,
    fitLabel: 'Excellent profile match',
    eligibility: 'unresolved',
    competitiveness: 'high',
    confidence: 'high',
    reasons: [
      'No nationality restriction, so your citizenship does not affect eligibility.',
      'Funding is complete: tuition, a living stipend and health coverage.',
    ],
    warnings: [
      'Around 400 awards are made each year, so competition is high.',
      'You need an admission offer from a participating Canadian institution, which is a separate application.',
    ],
    recommendation:
      'Apply once you have a university offer. Shortlist two Canadian institutions now so the scholarship deadline is not the binding constraint.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:26:45.000Z',
  },
  {
    id: '0a000000-0000-4000-8000-000000000004',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000004',
    fitScore: 74,
    fitLabel: 'Good profile match',
    eligibility: 'unresolved',
    competitiveness: 'moderate',
    confidence: 'medium',
    reasons: [
      'Your graduate enrolment satisfies the stated requirement.',
      'The work is closely aligned with your computational biology background.',
    ],
    warnings: [
      'A USD 3,500 stipend does not cover travel and housing, leaving a gap we estimate at roughly USD 3,200.',
      'Work authorisation for the host country is not addressed by the call, and sponsorship is not stated.',
    ],
    recommendation:
      'A real option but not fully funded, and the visa route is unclear. Get the work-authorisation answer before investing in an application.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:28:00.000Z',
  },
  {
    id: '0a000000-0000-4000-8000-000000000005',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000005',
    fitScore: 81,
    fitLabel: 'Excellent profile match',
    eligibility: 'unresolved',
    competitiveness: 'unknown',
    confidence: 'low',
    reasons: ['Your genomics background matches the call’s focus on public-health genomics.'],
    warnings: [
      'The annex listing eligible nationalities was not published on the page we could reach, so eligibility is unverified.',
      'The award amount and the deadline are both missing from the sources we reached.',
    ],
    recommendation:
      'Do not spend application time here yet. The single blocking question is whether Algeria appears in Annex A — check that first.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:29:15.000Z',
  },
  {
    id: '0a000000-0000-4000-8000-000000000006',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000006',
    fitScore: 88,
    fitLabel: 'Excellent profile match',
    eligibility: 'likely',
    competitiveness: 'moderate',
    confidence: 'high',
    reasons: [
      'Your Master’s enrolment and your PyTorch and Python experience match the stated requirements directly.',
      'Funding is complete: salary, travel and an equipment budget.',
    ],
    warnings: [
      'Two sources give different closing dates, so the deadline is not yet safe to rely on.',
    ],
    recommendation:
      'Excellent fit and fully funded. Open the official call to settle the deadline, then start the application early.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:30:30.000Z',
  },
  {
    id: '0a000000-0000-4000-8000-000000000007',
    missionId: '1b000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000007',
    fitScore: 58,
    fitLabel: 'Partial profile match',
    eligibility: 'unresolved',
    competitiveness: 'unknown',
    confidence: 'low',
    reasons: [],
    warnings: [
      'The official announcement could not be reached, so no requirement has been verified for this programme.',
    ],
    recommendation:
      'We could not verify anything about this programme. Open the official page or upload the announcement PDF so we can analyse it properly.',
    profileSnapshotId: 'c3000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-18T21:31:50.000Z',
  },
];
