import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
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
      throw new ForbiddenException('Boshqa filial foydalanuvchisini ko\'rishga ruxsat yo\'q');
    }

    return user;
  }

  async create(dto: CreateUserDto, requester: AuthUserView) {
    // 1. Xavfsizlik: Faqat SUPER_ADMIN yangi SUPER_ADMIN yarata oladi
    if (dto.role === UserRole.SUPER_ADMIN && requester.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Siz Super Admin yarata olmaysiz');
    }

    // 2. Xavfsizlik: Admin faqat o'z filiali uchun foydalanuvchi yarata oladi
    let finalBranchId = dto.branchId;
    if (requester.role !== UserRole.SUPER_ADMIN) {
      finalBranchId = requester.branchId; // Admin o'z branchId sini o'zgartira olmaydi
    }

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
        branchId: finalBranchId,
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
       throw new ForbiddenException('Boshqa filial foydalanuvchisini tahrirlashga ruxsat yo\'q');
    }

    // 3. Xavfsizlik: Admin rolni SUPER_ADMIN ga o'zgartira olmaydi
    if (dto.role === UserRole.SUPER_ADMIN && requester.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Siz Super Admin rolini bera olmaysiz');
    }

    const data: any = { ...dto };
    
    // 4. Xavfsizlik: Admin o'zining yoki boshqaning branchId sini o'zgartira olmaydi
    if (requester.role !== UserRole.SUPER_ADMIN) {
      delete data.branchId;
    }

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

    // 5. Xavfsizlik: O'zini o'zi o'chira olmasligi kerak
    if (id === requester.id) {
      throw new ForbiddenException('O\'zingizni o\'zingiz o\'chira olmaysiz');
    }

    // Multi-branch isolation
    if (requester.role !== UserRole.SUPER_ADMIN && user.branchId !== requester.branchId) {
      throw new ForbiddenException('Boshqa filial foydalanuvchisini o\'chirishga ruxsat yo\'q');
    }

    // 6. Xavfsizlik: Admin Super Adminni o'chira olmaydi
    if (user.role === UserRole.SUPER_ADMIN && requester.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super Adminni o\'chirishga ruxsat yo\'q');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id };
  }
}
