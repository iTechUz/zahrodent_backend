import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUserView } from '../auth/auth.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUserView) {
    const where: any = { deletedAt: null };
    
    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.branchId = user.branchId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        branchId: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requester: AuthUserView) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        branchId: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
      },
    });
    if (!user || user.deletedAt) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Multi-branch isolation
    if (requester.role !== UserRole.SUPER_ADMIN && user.branchId !== requester.branchId) {
      throw new NotFoundException('Foydalanuvchi topilmadi (ruxsat cheklangan)');
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing)
      throw new ConflictException(
        'Ushbu telefon raqami bilan foydalanuvchi allaqachon mavjud',
      );

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password, ...data } = dto;

    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        branchId: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto, requester: AuthUserView) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Multi-branch isolation
    if (requester.role !== UserRole.SUPER_ADMIN && user.branchId !== requester.branchId) {
       throw new NotFoundException('Foydalanuvchi topilmadi (ruxsat cheklangan)');
    }

    const data: any = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      delete data.password;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
      },
    });
  }

  async remove(id: string, requester: AuthUserView) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Multi-branch isolation
    if (requester.role !== UserRole.SUPER_ADMIN && user.branchId !== requester.branchId) {
      throw new NotFoundException('Foydalanuvchi topilmadi (ruxsat cheklangan)');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id };
  }
}
