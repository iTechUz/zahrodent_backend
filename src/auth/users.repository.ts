import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { revokeAllUserRefreshTokens } from './refresh-tokens.repository';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Fresh identity for token validation (role/doctor may have changed). */
  findAuthById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        specialty: true,
        avatar: true,
        doctor: { select: { id: true } },
      },
    });
  }

  findDoctorByUserId(userId: string): Promise<{ id: string } | null> {
    return this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  /** New password hash + every refresh token revoked, atomically. */
  async updatePasswordAndRevokeSessions(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await revokeAllUserRefreshTokens(tx, id);
    });
  }
}
