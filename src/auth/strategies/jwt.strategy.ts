import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUserView } from '../auth.service';
import type { JwtAccessPayload } from '../../common/auth/jwt-access-payload';
import { AppRole } from '../../common/decorators/roles.decorator';

function isJwtAccessPayload(p: unknown): p is JwtAccessPayload {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.sub === 'string' &&
    typeof o.email === 'string' &&
    typeof o.name === 'string' &&
    typeof o.role === 'string' &&
    ['admin', 'doctor', 'receptionist'].includes(o.role as string)
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }

  validate(payload: unknown): AuthUserView {
    if (!isJwtAccessPayload(payload)) {
      throw new UnauthorizedException('Token yangilanishi kerak — qayta kiring');
    }
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role as AppRole,
      specialty: payload.specialty,
      avatar: payload.avatar,
    };
  }
}
