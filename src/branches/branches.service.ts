import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            patients: true,
            users: true,
          },
        },
      },
    });
  }

  async getGlobalStats() {
    const branchStats = await this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            patients: true,
            bookings: true,
          },
        },
      },
    });

    const revenues = await this.prisma.payment.groupBy({
      by: ['branchId'],
      _sum: {
        amount: true,
      },
      where: {
        status: 'INCOME',
      },
    });

    return branchStats.map(branch => {
      const revenue = revenues.find(r => r.branchId === branch.id);
      return {
        ...branch,
        totalRevenue: revenue?._sum?.amount?.toNumber() || 0,
      };
    });
  }

  async findOne(id: string, user?: AuthUserView) {
    if (user && user.role !== UserRole.SUPER_ADMIN && user.branchId !== id) {
      throw new ForbiddenException('Siz faqat o\'zingizning filialingizni ko\'ra olasiz');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            patients: true,
            users: true,
            bookings: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          }
        },
        patients: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            balance: true,
          }
        },
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            patient: { select: { firstName: true, lastName: true } },
            doctor: { include: { user: { select: { name: true } } } }
          }
        }
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(data: any) {
    const { adminName, adminPhone, adminPassword, ...branchData } = data;

    // Check if phone already exists
    const existingUser = await this.prisma.user.findUnique({ where: { phone: adminPhone } });
    if (existingUser) throw new ConflictException('Ushbu telefon raqami bilan foydalanuvchi allaqachon mavjud');

    if (branchData.latitude) branchData.latitude = parseFloat(branchData.latitude);
    if (branchData.longitude) branchData.longitude = parseFloat(branchData.longitude);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Branch
      const branch = await tx.branch.create({ data: branchData });

      // 2. Create Admin User
      if (adminPhone && adminPassword) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await tx.user.create({
          data: {
            name: adminName || `${branch.name} Admin`,
            phone: adminPhone,
            passwordHash,
            role: UserRole.ADMIN,
            branchId: branch.id,
          },
        });
      }

      return branch;
    });
  }

  async update(id: string, data: any, user?: AuthUserView) {
    await this.findOne(id, user);
    if (data.latitude) data.latitude = parseFloat(data.latitude);
    if (data.longitude) data.longitude = parseFloat(data.longitude);
    return this.prisma.branch.update({ where: { id }, data });
  }

  async remove(id: string) {
    const branch = await this.findOne(id);
    if (branch.name.includes('Zahro Dental (Main)')) {
      throw new ForbiddenException('Asosiy filialni o\'chirib bo\'lmaydi');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Deactivate all users of this branch
      await tx.user.updateMany({
        where: { branchId: id },
        data: { isActive: false, deletedAt: new Date() },
      });

      // 2. Soft delete the branch
      return tx.branch.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
    });
  }
}
