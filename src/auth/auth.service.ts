import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
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
export const ACCOUNT_DEACTIVATED_MESSAGE =
  'Hisobingiz faolsizlantirilgan — administratorga murojaat qiling';
export const TOKEN_REFRESH_MESSAGE = 'Token yangilanishi kerak — qayta kiring';
export const SESSION_EXPIRED_MESSAGE = 'Sessiya muddati tugagan, qayta kiring';
export const LOGIN_LOCKED_MESSAGE =
  "Juda ko'p noto'g'ri urinish — 15 daqiqadan keyin qayta urinib ko'ring";
/** Per-phone lockout: this many failures in a row … */
export const LOGIN_MAX_FAILURES = 10;
/** … lock the account's login for this long. */
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
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

const APP_ROLES: readonly string[] = [
  'admin',
  'doctor',
  'receptionist',
  'pharmacist',
];
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

  /**
   * Failed logins per phone (known or not — no account probing). In-memory:
   * per API instance, reset on restart; the per-IP throttler stays the
   * first line of defence. Trade-off: someone can lock a victim out for 15
   * minutes by guessing wrong passwords on purpose.
   */
  private readonly loginFailures = new Map<
    string,
    { count: number; lockedUntil: number }
  >();

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensRepository,
  ) {}

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<AuthSession> {
    this.assertLoginNotLocked(dto.phone);
    const user = await this.usersRepository.findByPhone(dto.phone);
    // Same message for unknown phone and wrong password (no account probing).
    // bcrypt still runs for unknown phones so timing doesn't leak either.
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_BCRYPT_HASH,
    );
    if (!user || !ok) {
      this.recordLoginFailure(dto.phone);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    this.loginFailures.delete(dto.phone);
    // Parol to'g'ri bo'lgandan keyingina aytamiz (akkaunt mavjudligi sizib chiqmasin).
    if (!user.isActive) {
      throw new UnauthorizedException(ACCOUNT_DEACTIVATED_MESSAGE);
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

  private assertLoginNotLocked(phone: string) {
    const f = this.loginFailures.get(phone);
    if (!f || f.lockedUntil === 0) return;
    if (f.lockedUntil > Date.now()) {
      throw new HttpException(
        LOGIN_LOCKED_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Lock expired → fresh start.
    this.loginFailures.delete(phone);
  }

  private recordLoginFailure(phone: string) {
    const now = Date.now();
    // Opportunistic cleanup keeps the map from growing without bound.
    if (this.loginFailures.size > 10_000) {
      for (const [k, v] of this.loginFailures) {
        if (v.lockedUntil !== 0 && v.lockedUntil <= now) {
          this.loginFailures.delete(k);
        }
      }
    }
    const f = this.loginFailures.get(phone) ?? { count: 0, lockedUntil: 0 };
    f.count += 1;
    if (f.count >= LOGIN_MAX_FAILURES) {
      f.lockedUntil = now + LOGIN_LOCK_MS;
      this.logger.warn(`Login bloklandi (15 daqiqa): ${phone}`);
    }
    this.loginFailures.set(phone, f);
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
    if (!user || !user.isActive || !APP_ROLES.includes(user.role)) {
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
   * malformed/stale, the user no longer exists or is deactivated.
   * Role and doctorId always come from the DB, not from the token.
   */
  async resolveTokenUser(payload: unknown): Promise<AuthUserView | null> {
    if (!isJwtAccessPayload(payload)) return null;
    const user = await this.usersRepository.findAuthById(payload.sub);
    if (!user || !user.isActive || !APP_ROLES.includes(user.role)) return null;
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
