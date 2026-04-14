import type { AppRole } from '../decorators/roles.decorator';

/** Frontend `roleAccess` va klinika jarayoniga mos: barcha autentifikatsiyalangan xodimlar. */
export const ROLES_STAFF: AppRole[] = ['admin', 'doctor', 'receptionist'];

/** Faqat moliya moduli (frontendda faqat admin `/finance`). */
export const ROLES_FINANCE: AppRole[] = ['admin'];

/** Shifokor katalogini boshqarish (GET barcha staff uchun). */
export const ROLES_DOCTOR_WRITE: AppRole[] = ['admin', 'doctor'];
