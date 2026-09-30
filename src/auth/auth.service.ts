import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersRepository } from './users.repository';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AppRole } from '../common/decorators/roles.decorator';
import type { JwtAccessPayload } from '../common/auth/jwt-access-payload';
import {
  generateRefreshToken,
  hashRefreshToken,
  RefreshTokensRepository,
} from './refresh-tokens.repository';
import { getAccessTokenTtlSeconds, getRefreshTokenTtlDays } from './token-ttl';

export type AuthUserView = {
  id: string;
  name: string;
  phone: string;
  role: AppRole;
  specialty?: string;
  avatar?: string;
  doctorId?: string; // Doctor record id (for doctor role only)
};

export const INVALID_CREDENTIALS_MESSAGE =
  "Telefon raqami yoki parol noto'g'ri";
export const TOKEN_REFRESH_MESSAGE = 'Token yangilanishi kerak — qayta kiring';
export const SESSION_EXPIRED_MESSAGE = 'Sessiya muddati tugagan, qayta kiring';
export const WRONG_CURRENT_PASSWORD_MESSAGE = "Joriy parol noto'g'ri";

/** Client metadata stored with a refresh token (audit only). */
export type SessionMeta = { userAgent?: string; ip?: string };

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  /** Access token lifetime in seconds. */
  expires_in: number;
  user: AuthUserView;
};

export type MeView = {
  id: string;
  name: string;
  phone: string;
  role: AppRole;
  doctorId: string | null;
};

const USER_AGENT_MAX = 512;
const IP_MAX = 64;
const BCRYPT_ROUNDS = 10;

const APP_ROLES: readonly string[] = ['admin', 'doctor', 'receptionist'];
// bcrypt hash of a throwaway string — compared against for unknown phones.
const DUMMY_BCRYPT_HASH =
  '$2b$10$SgcmXHrYsTKpWDPH8w3xh.fROlQEv1n8B/n1QHbkGg7b2Z82wvgiS';

function isJwtAccessPayload(p: unknown): p is JwtAccessPayload {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.sub === 'string' &&
    typeof o.phone === 'string' &&
    typeof o.name === 'string' &&
    typeof o.role === 'string' &&
    APP_ROLES.includes(o.role)
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensRepository,
  ) {}

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<AuthSession> {
    const user = await this.usersRepository.findByPhone(dto.phone);
    // Same message for unknown phone and wrong password (no account probing).
    // bcrypt still runs for unknown phones so timing doesn't leak either.
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_BCRYPT_HASH,
    );
    if (!user || !ok) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    // If doctor role, fetch the associated Doctor record id
    let doctorId: string | undefined;
    if (user.role === 'doctor') {
      const doctor = await this.usersRepository.findDoctorByUserId(user.id);
      doctorId = doctor?.id;
    }
    const view = this.toUserView(user, doctorId);
    return this.issueSession(view, randomUUID(), meta);
  }

  /**
   * Rotating refresh: the presented token is revoked and replaced. A revoked
   * token presented again means it leaked (or was replayed) → the whole
   * family (every token descended from the same login) is revoked.
   */
  async refresh(refreshToken: string, meta: SessionMeta = {}) {
    const now = new Date();
    const row = await this.refreshTokens.findByHash(
      hashRefreshToken(refreshToken),
    );
    if (!row) throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);

    if (row.revokedAt) {
      const n = await this.refreshTokens.revokeFamily(row.familyId, now);
      this.logger.warn(
        `Refresh token qayta ishlatildi (user ${row.userId}, family ${row.familyId}) — ${n} ta sessiya bekor qilindi`,
      );
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }

    const user = await this.usersRepository.findAuthById(row.userId);
    if (!user || !APP_ROLES.includes(user.role)) {
      await this.refreshTokens.revokeFamily(row.familyId, now);
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }
    const view = this.toUserView(
      user,
      user.role === 'doctor' ? user.doctor?.id : undefined,
    );

    const next = this.newRefreshToken(user.id, row.familyId, meta, now);
    const rotated = await this.refreshTokens.rotate(row.id, next.data, now);
    if (!rotated) {
      // Lost a race with another request presenting the same token → reuse.
      await this.refreshTokens.revokeFamily(row.familyId, now);
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }
    return this.buildSession(view, next.token);
  }

  /** Revokes the given refresh token. Idempotent; unknown tokens are fine. */
  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.refreshTokens.revokeByHash(hashRefreshToken(refreshToken));
    return { success: true };
  }

  me(user: AuthUserView): MeView {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      doctorId: user.doctorId ?? null,
    };
  }

  /** Changes own password and ends every session (all refresh tokens). */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UnauthorizedException(TOKEN_REFRESH_MESSAGE);
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException(WRONG_CURRENT_PASSWORD_MESSAGE);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.updatePasswordAndRevokeSessions(
      userId,
      passwordHash,
    );
    return { success: true };
  }

  private async issueSession(
    view: AuthUserView,
    familyId: string,
    meta: SessionMeta,
  ): Promise<AuthSession> {
    const next = this.newRefreshToken(view.id, familyId, meta);
    await this.refreshTokens.create(next.data);
    return this.buildSession(view, next.token);
  }

  private newRefreshToken(
    userId: string,
    familyId: string,
    meta: SessionMeta,
    now: Date = new Date(),
  ) {
    const token = generateRefreshToken();
    const ttlMs = getRefreshTokenTtlDays() * 86_400_000;
    return {
      token,
      data: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(token),
        expiresAt: new Date(now.getTime() + ttlMs),
        userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX) || null,
        ip: meta.ip?.slice(0, IP_MAX) || null,
      },
    };
  }

  private async buildSession(
    view: AuthUserView,
    refreshToken: string,
  ): Promise<AuthSession> {
    const payload: JwtAccessPayload = {
      sub: view.id,
      role: view.role,
      phone: view.phone,
      name: view.name,
      specialty: view.specialty,
      avatar: view.avatar,
      doctorId: view.doctorId,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      refresh_token: refreshToken,
      expires_in: getAccessTokenTtlSeconds(),
      user: view,
    };
  }

  /**
   * Token payload → current user from the DB. `null` when the payload is
   * malformed/stale or the user no longer exists (deleted = revoked).
   * Role and doctorId always come from the DB, not from the token.
   */
  async resolveTokenUser(payload: unknown): Promise<AuthUserView | null> {
    if (!isJwtAccessPayload(payload)) return null;
    const user = await this.usersRepository.findAuthById(payload.sub);
    if (!user || !APP_ROLES.includes(user.role)) return null;
    return this.toUserView(
      user,
      user.role === 'doctor' ? user.doctor?.id : undefined,
    );
  }

  toUserView(
    user: {
      id: string;
      name: string;
      phone: string;
      role: string;
      specialty: string | null;
      avatar: string | null;
    },
    doctorId?: string,
  ): AuthUserView {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role as AppRole,
      specialty: user.specialty ?? undefined,
      avatar: user.avatar ?? undefined,
      doctorId,
    };
  }
}
