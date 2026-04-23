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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findByPhone(dto.phone);
    if (!user) {
      throw new UnauthorizedException("Telefon raqami yoki parol noto'g'ri");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Telefon raqami yoki parol noto'g'ri");
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
