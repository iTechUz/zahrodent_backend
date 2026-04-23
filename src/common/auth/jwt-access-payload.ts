import type { AppRole } from '../decorators/roles.decorator';

export type JwtAccessPayload = {
  sub: string;
  role: AppRole;
  phone: string;
  name: string;
  specialty?: string;
  avatar?: string;
  doctorId?: string; // Doctor record id (differs from user id)
};
