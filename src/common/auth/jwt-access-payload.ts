import type { AppRole } from '../decorators/roles.decorator';

/** JWT ichida saqlanadi; har so‘rovda DB chaqiruvsiz `request.user` shu yerdan. */
export type JwtAccessPayload = {
  sub: string;
  role: AppRole;
  email: string;
  name: string;
  specialty?: string;
  avatar?: string;
};
