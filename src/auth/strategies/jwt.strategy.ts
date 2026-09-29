import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthService,
  AuthUserView,
  TOKEN_REFRESH_MESSAGE,
} from '../auth.service';
import { getJwtSecret } from '../../bootstrap/env-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /** Re-reads the user on every request so deletions/role changes apply. */
  async validate(payload: unknown): Promise<AuthUserView> {
    const user = await this.authService.resolveTokenUser(payload);
    if (!user) throw new UnauthorizedException(TOKEN_REFRESH_MESSAGE);
    return user;
  }
}
