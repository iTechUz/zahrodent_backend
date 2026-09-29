import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUserView } from '../../auth/auth.service';

export const DOCTOR_PROFILE_MISSING_MESSAGE =
  'Shifokor profili topilmadi — administratorga murojaat qiling';

/**
 * For a `doctor` user returns their Doctor record id; for other roles
 * returns `null` (no scoping). A doctor account without a linked Doctor
 * record gets 403 — never the unscoped (clinic-wide) data.
 */
export function doctorScopeId(user: AuthUserView): string | null {
  if (user.role !== 'doctor') return null;
  if (!user.doctorId) {
    throw new ForbiddenException(DOCTOR_PROFILE_MISSING_MESSAGE);
  }
  return user.doctorId;
}

/** Patients that belong to a doctor: assigned, booked or visited. */
export function doctorPatientsWhere(
  doctorId: string,
): Prisma.PatientWhereInput {
  return {
    OR: [
      { assignedDoctorId: doctorId },
      { bookings: { some: { doctorId } } },
      { visits: { some: { doctorId } } },
    ],
  };
}
