import { UserRole } from '@prisma/client';

export const ROLES_STAFF: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DOCTOR,
  UserRole.RECEPTIONIST,
  UserRole.SUPER_ADMIN,
];

export const ROLES_FINANCE: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];
