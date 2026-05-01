import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUserView } from '../auth.service';
import type { JwtAccessPayload } from '../../common/auth/jwt-access-payload';
import { AppRole } from '../../common/decorators/roles.decorator';
import { getJwtSecret } from '../../bootstrap/env-config';
import { UserRole } from '@prisma/client';

function isJwtAccessPayload(p: unknown): p is JwtAccessPayload {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  const roles = Object.values(UserRole) as string[];
  return (
    typeof o.sub === 'string' &&
    typeof o.phone === 'string' &&
    typeof o.name === 'string' &&
    typeof o.role === 'string' &&
    roles.includes(o.role as string)
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  validate(payload: unknown): AuthUserView {
    if (!isJwtAccessPayload(payload)) {
      throw new UnauthorizedException(
        'Token yangilanishi kerak — qayta kiring',
      );
    }
    return {
      id: payload.sub,
      name: payload.name,
      phone: payload.phone,
      role: payload.role as AppRole,
      avatar: payload.avatar,
      doctorId: payload.doctorId,
      branchId: payload.branchId,
    };
  }
}
