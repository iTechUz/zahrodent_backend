import type { AppRole } from '../decorators/roles.decorator';

export type JwtAccessPayload = {
  sub: string;
  role: AppRole;
  email: string;
  name: string;
  specialty?: string;
  avatar?: string;
};
