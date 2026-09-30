import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { RefreshTokensCleanupService } from './refresh-tokens-cleanup.service';
import { getJwtSecret } from '../bootstrap/env-config';
import { getAccessTokenTtlSeconds } from './token-ttl';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      // Seconds, so `expires_in` in the login response always matches.
      signOptions: { expiresIn: getAccessTokenTtlSeconds() },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    JwtStrategy,
    RefreshTokensRepository,
    RefreshTokensCleanupService,
  ],
  exports: [AuthService, UsersRepository, JwtModule],
})
export class AuthModule {}
