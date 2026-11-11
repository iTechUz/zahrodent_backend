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
/** Per phone+IP lockout: this many failures in a row from ONE IP … */
export const LOGIN_MAX_FAILURES = 10;
/** … lock that phone+IP pair for this long (other IPs are unaffected). */
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
/**
 * Looser per-phone ceiling (all IPs together): protects against a distributed
 * guesser. When hit, only IPs that never logged in successfully for this phone
 * are blocked — a "known-good" IP (successful login within the TTL) still passes.
 */
export const LOGIN_PHONE_MAX_FAILURES = 50;
/** How long a successful login keeps its IP "known good" for that phone. */
export const KNOWN_IP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KNOWN_IPS_PER_PHONE = 5;
const LOGIN_MAP_CLEANUP_AT = 10_000;
const UNKNOWN_IP = 'unknown';

/** +998901234567 → +99890***4567 (raw phones never go to logs). */
export function maskPhone(phone: string): string {
  if (phone.length < 10) return '***';
  return `${phone.slice(0, 6)}***${phone.slice(-4)}`;
}
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
   * Failed logins per phone+IP (known or not — no account probing). In-memory:
   * per API instance, reset on restart; the per-IP throttler stays the first
   * line of defence. Keyed by IP too, so a stranger guessing wrong passwords
   * from his own IP locks only himself out, not the real user.
   */
  private readonly loginFailures = new Map<
    string,
    { count: number; lockedUntil: number }
  >();

  /** Looser per-phone counter (all IPs); see LOGIN_PHONE_MAX_FAILURES. */
  private readonly phoneFailures = new Map<
    string,
    { count: number; lockedUntil: number }
  >();

  /** phone → (ip → expiresAt) of successful logins ("known-good paths"). */
  private readonly knownIps = new Map<string, Map<string, number>>();

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensRepository,
  ) {}

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<AuthSession> {
    const ip = meta.ip?.slice(0, IP_MAX) || UNKNOWN_IP;
    this.assertLoginNotLocked(dto.phone, ip);
    const user = await this.usersRepository.findByPhone(dto.phone);
    // Same message for unknown phone and wrong password (no account probing).
    // bcrypt still runs for unknown phones so timing doesn't leak either.
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_BCRYPT_HASH,
    );
    if (!user || !ok) {
      this.recordLoginFailure(dto.phone, ip);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    this.loginFailures.delete(`${dto.phone}|${ip}`);
    this.phoneFailures.delete(dto.phone);
    this.rememberKnownIp(dto.phone, ip);
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

  private assertLoginNotLocked(phone: string, ip: string) {
    const now = Date.now();
    const pair = this.loginFailures.get(`${phone}|${ip}`);
    if (pair && pair.lockedUntil > now) this.throwLocked();
    if (pair && pair.lockedUntil !== 0) {
      // Lock expired → fresh start.
      this.loginFailures.delete(`${phone}|${ip}`);
    }
    const byPhone = this.phoneFailures.get(phone);
    if (byPhone && byPhone.lockedUntil !== 0) {
      if (byPhone.lockedUntil > now) {
        // Phone-wide ceiling: only a known-good IP may still try.
        if (!this.isKnownIp(phone, ip, now)) this.throwLocked();
      } else {
        this.phoneFailures.delete(phone);
      }
    }
  }

  private throwLocked(): never {
    throw new HttpException(LOGIN_LOCKED_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }

  private recordLoginFailure(phone: string, ip: string) {
    const now = Date.now();
    // Opportunistic cleanup keeps the maps from growing without bound.
    for (const map of [this.loginFailures, this.phoneFailures]) {
      if (map.size > LOGIN_MAP_CLEANUP_AT) {
        for (const [k, v] of map) {
          if (v.lockedUntil !== 0 && v.lockedUntil <= now) map.delete(k);
        }
      }
    }
    const key = `${phone}|${ip}`;
    const f = this.loginFailures.get(key) ?? { count: 0, lockedUntil: 0 };
    f.count += 1;
    if (f.count >= LOGIN_MAX_FAILURES) {
      f.lockedUntil = now + LOGIN_LOCK_MS;
      this.logger.warn(
        `Login bloklandi (15 daqiqa): ${maskPhone(phone)} ip=${ip}`,
      );
    }
    this.loginFailures.set(key, f);

    const p = this.phoneFailures.get(phone) ?? { count: 0, lockedUntil: 0 };
    p.count += 1;
    if (p.count >= LOGIN_PHONE_MAX_FAILURES && p.lockedUntil === 0) {
      p.lockedUntil = now + LOGIN_LOCK_MS;
      this.logger.warn(
        `Login umumiy limiti (barcha IP): ${maskPhone(phone)} — noma'lum IP'lar 15 daqiqaga bloklandi`,
      );
    }
    this.phoneFailures.set(phone, p);
  }

  private isKnownIp(phone: string, ip: string, now: number): boolean {
    const exp = this.knownIps.get(phone)?.get(ip);
    return exp !== undefined && exp > now;
  }

  private rememberKnownIp(phone: string, ip: string) {
    if (ip === UNKNOWN_IP) return;
    const now = Date.now();
    if (this.knownIps.size > LOGIN_MAP_CLEANUP_AT) this.knownIps.clear();
    const ips = this.knownIps.get(phone) ?? new Map<string, number>();
    ips.delete(ip); // re-insert → newest last
    ips.set(ip, now + KNOWN_IP_TTL_MS);
    for (const [k, exp] of ips) if (exp <= now) ips.delete(k);
    while (ips.size > KNOWN_IPS_PER_PHONE) {
      const oldest = ips.keys().next().value as string;
      ips.delete(oldest);
    }
    this.knownIps.set(phone, ips);
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
