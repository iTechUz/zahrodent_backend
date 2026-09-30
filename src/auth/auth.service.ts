import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { LoginDto } from './dto/login.dto';
import { AppRole } from '../common/decorators/roles.decorator';
import type { JwtAccessPayload } from '../common/auth/jwt-access-payload';

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
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
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
    const payload: JwtAccessPayload = {
      sub: user.id,
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
