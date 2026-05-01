import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { LoginDto } from './dto/login.dto';
import { AppRole } from '../common/decorators/roles.decorator';
import type { JwtAccessPayload } from '../common/auth/jwt-access-payload';
import { UserRole } from '@prisma/client';

export type AuthUserView = {
  id: string;
  name: string;
  phone: string;
  role: AppRole;
  avatar?: string;
  doctorId?: string; 
  branchId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const normalizedPhone = dto.phone.replace(/\D/g, '');
    const user = await this.usersRepository.findByPhone(normalizedPhone);
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException("Bunday telefon raqamli foydalanuvchi topilmadi yoki hisob faol emas");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Kiritilgan parol noto'g'ri");
    }

    let doctorId: string | undefined;
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.usersRepository.findDoctorByUserId(user.id);
      doctorId = doctor?.id;
    }

    const view = this.toUserView(user, doctorId);
    const payload: JwtAccessPayload = {
      sub: user.id,
      role: view.role,
      phone: view.phone,
      name: view.name,
      avatar: view.avatar,
      doctorId: view.doctorId,
      branchId: view.branchId,
    };

    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      user: view,
    };
  }

  async changePassword(userId: string, dto: any) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Joriy parol noto'g'ri");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.updatePassword(userId, passwordHash);
    return { success: true };
  }

  toUserView(
    user: any,
    doctorId?: string,
  ): AuthUserView {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role as AppRole,
      avatar: user.avatar ?? undefined,
      branchId: user.branchId ?? undefined,
      doctorId,
    };
  }
}
