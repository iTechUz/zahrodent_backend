import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { revokeAllUserRefreshTokens } from '../auth/refresh-tokens.repository';

export const PHONE_TAKEN_MESSAGE =
  'Ushbu telefon raqami bilan foydalanuvchi allaqachon mavjud';
export const USER_NOT_FOUND = 'Foydalanuvchi topilmadi';
export const CANNOT_DELETE_SELF = "O'zingizning hisobingizni o'chira olmaysiz";
export const LAST_ADMIN_MESSAGE =
  "Tizimdagi yagona adminni o'chirib yoki rolini o'zgartirib bo'lmaydi";

export const DOCTOR_VIA_DOCTORS_MESSAGE =
  "Shifokor foydalanuvchisini bu yerda yaratib bo'lmaydi — /doctors orqali shifokor qo'shing (login ham o'sha yerda beriladi)";

const PUBLIC_SELECT = {
  id: true,
  name: true,
  phone: true,
  role: true,
  specialty: true,
  avatar: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UsersQueryDto = {}) {
    const orderBy =
      query.sortBy || query.order
        ? [
            { [query.sortBy ?? 'createdAt']: query.order ?? 'asc' },
            { id: query.order ?? 'asc' },
          ]
        : { createdAt: 'desc' as const };
    return this.prisma.user.findMany({
      select: PUBLIC_SELECT,
      orderBy: orderBy as Prisma.UserOrderByWithRelationInput,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException(USER_NOT_FOUND);
    return user;
  }

  /** 409 if another user already has this phone. */
  async assertPhoneAvailable(phone: string, exceptUserId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException(PHONE_TAKEN_MESSAGE);
    }
  }

  /** Validated create payload (phone free, password hashed). No write. */
  async buildCreateData(dto: CreateUserDto): Promise<Prisma.UserCreateInput> {
    await this.assertPhoneAvailable(dto.phone);
    const { password, ...rest } = dto;
    return { ...rest, passwordHash: await bcrypt.hash(password, 10) };
  }

  /** Validated update payload (phone free, password hashed). No write. */
  async buildUpdateData(
    id: string,
    dto: UpdateUserDto,
  ): Promise<Prisma.UserUpdateInput> {
    if (dto.phone) await this.assertPhoneAvailable(dto.phone, id);
    const { password, ...rest } = dto;
    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    return data;
  }

  async create(dto: CreateUserDto) {
    // A doctor login without a Doctor record would be a dead account
    // (no schedule, no bookings): /doctors creates both atomically.
    if (dto.role === 'doctor') {
      throw new BadRequestException(DOCTOR_VIA_DOCTORS_MESSAGE);
    }
    const data = await this.buildCreateData(dto);
    return this.prisma.user.create({
      data,
      select: { id: true, name: true, phone: true, role: true },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(USER_NOT_FOUND);

    if (dto.role === 'doctor' && user.role !== 'doctor') {
      throw new BadRequestException(DOCTOR_VIA_DOCTORS_MESSAGE);
    }

    const data = await this.buildUpdateData(id, dto);
    const select = { id: true, name: true, phone: true, role: true } as const;
    const demotesAdmin =
      user.role === 'admin' && !!dto.role && dto.role !== 'admin';
    const updated = demotesAdmin
      ? await this.prisma.$transaction(async (tx) => {
          await this.assertNotLastAdmin(tx, id);
          return tx.user.update({ where: { id }, data, select });
        })
      : await this.prisma.user.update({ where: { id }, data, select });
    // New password or role → existing sessions must log in again.
    if (dto.password || (dto.role && dto.role !== user.role)) {
      await this.revokeSessions(id);
    }
    return updated;
  }

  /** Revokes every refresh token of the user (forces a new login). */
  revokeSessions(userId: string): Promise<number> {
    return revokeAllUserRefreshTokens(this.prisma, userId);
  }

  async remove(id: string, currentUserId?: string) {
    if (currentUserId && id === currentUserId) {
      throw new ConflictException(CANNOT_DELETE_SELF);
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(USER_NOT_FOUND);

    // refresh_tokens.user_id is ON DELETE CASCADE → sessions go with the user.
    if (user.role === 'admin') {
      await this.prisma.$transaction(async (tx) => {
        await this.assertNotLastAdmin(tx, id);
        await tx.user.delete({ where: { id } });
      });
    } else {
      await this.prisma.user.delete({ where: { id } });
    }
    return { id };
  }

  /**
   * Locks every admin row (FOR UPDATE) for the rest of the transaction, so two
   * concurrent demotions/deletions of different admins serialise and the
   * second one sees the first's result instead of both passing the check.
   */
  private async assertNotLastAdmin(
    tx: Prisma.TransactionClient,
    targetId: string,
  ) {
    const admins = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE role = 'admin' FOR UPDATE
    `;
    if (admins.length <= 1 && admins.some((a) => a.id === targetId)) {
      throw new ConflictException(LAST_ADMIN_MESSAGE);
    }
  }
}
