import { SetMetadata } from '@nestjs/common';
import { RolesEnum } from 'src/constantis';
export const ROLES_KEY = 'roles';
export const RolesD = (...roles: RolesEnum[]) => SetMetadata(ROLES_KEY, roles);
