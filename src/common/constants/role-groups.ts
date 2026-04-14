import type { AppRole } from '../decorators/roles.decorator';

export const ROLES_STAFF: AppRole[] = ['admin', 'doctor', 'receptionist'];

export const ROLES_FINANCE: AppRole[] = ['admin'];

export const ROLES_DOCTOR_WRITE: AppRole[] = ['admin', 'doctor'];
