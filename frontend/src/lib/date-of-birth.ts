/**
 * Date-of-birth parsing and validation.
 *
 * The date is entered twice over: with a date picker, and by typing it.
 * Both paths have to reach the same answer, and both have to reject the
 * impossible — a date that does not exist, or one that is in the future.
 *
 * This is shared by the onboarding question and the passport, so the two
 * never disagree about what a valid date is.
 */

export interface DateOfBirthParseError {
  error: string;
}

export type DateOfBirthParseResult = { iso: string } | DateOfBirthParseError;

/**
 * Parses `YYYY-MM-DD` or `DD/MM/YYYY` into an ISO date.
 *
 * Returns null for an empty input, an error for anything impossible.
 */
export function parseDateOfBirth(input: string): DateOfBirthParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const dayFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  let year: number;
  let month: number;
  let day: number;

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = Number(dayFirst[2]);
    year = Number(dayFirst[3]);
  } else {
    return { error: 'Use YYYY-MM-DD, or DD/MM/YYYY.' };
  }

  // A round trip through UTC rejects 31 February, and the same for every
  // other date that does not exist.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: 'That date does not exist.' };
  }

  if (date.getTime() > Date.now()) {
    return { error: 'A date of birth cannot be in the future.' };
  }

  const pad = (value: number) => String(value).padStart(2, '0');
  return { iso: `${year}-${pad(month)}-${pad(day)}` };
}

/** The answer a student gives when they would rather not say. */
export const PREFER_NOT_TO_SAY = 'prefer_not_to_say';

/** The latest date that can be a date of birth: today. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
