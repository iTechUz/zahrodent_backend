import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export type AppRole = keyof typeof UserRole;

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
