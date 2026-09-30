import type { Prisma } from '@prisma/client';

/**
 * Patient name attached to bookings / visits / payments. Kept for soft-deleted
 * patients too, so finance lists still show who it was (`deletedAt` set).
 */
export const PATIENT_SUMMARY_SELECT = {
  firstName: true,
  lastName: true,
  deletedAt: true,
} satisfies Prisma.PatientSelect;

export const WITH_PATIENT_SUMMARY = {
  patient: { select: PATIENT_SUMMARY_SELECT },
} as const;

export type PatientSummaryRow = {
  firstName: string;
  lastName: string;
  deletedAt: Date | null;
};

export type PatientSummary = {
  firstName: string;
  lastName: string;
  deletedAt: string | null;
};

export function toPatientSummary(
  p: PatientSummaryRow | null | undefined,
): PatientSummary | undefined {
  if (!p) return undefined;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
  };
}

/** Only non-deleted patients may be linked to new bookings/visits/payments. */
export function connectActivePatient(id: string) {
  return { connect: { id, deletedAt: null } };
}
