import { BadRequestException } from '@nestjs/common';

export const AGE_OR_BIRTH_YEAR_REQUIRED =
  'Yosh yoki tug‘ilgan yilni kiriting (age yoki birthYear)';
export const BIRTH_YEAR_IN_FUTURE =
  'Tug‘ilgan yil kelajakda bo‘lishi mumkin emas';

/**
 * `birthYear` is the source of truth; `age` stays as a snapshot column for
 * compatibility. Given either one (birthYear wins) returns both, or `null`
 * when neither was supplied.
 */
export function resolveAgeFields(
  input: { age?: number; birthYear?: number },
  currentYear: number,
): { age: number; birthYear: number } | null {
  if (input.birthYear !== undefined && input.birthYear !== null) {
    if (input.birthYear > currentYear) {
      throw new BadRequestException(BIRTH_YEAR_IN_FUTURE);
    }
    return {
      birthYear: input.birthYear,
      age: Math.min(120, currentYear - input.birthYear),
    };
  }
  if (input.age !== undefined && input.age !== null) {
    return { age: input.age, birthYear: currentYear - input.age };
  }
  return null;
}

/** Age shown by the API: computed from birthYear when present. */
export function displayAge(
  p: { age: number; birthYear?: number | null },
  currentYear: number,
): number {
  return p.birthYear != null ? Math.max(0, currentYear - p.birthYear) : p.age;
}
