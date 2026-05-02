import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUserView) {
    const where: Prisma.BranchWhereInput = { deletedAt: null };

    if (user.role !== UserRole.SUPER_ADMIN) {
      // Only show branches the user is associated with
      // Currently users have a single branchId, so we filter by that.
      if (!user.branchId) return [];
      where.id = user.branchId;
    }

    return this.prisma.branch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            patients: true,
            users: true,
            bookings: true,
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
    const normalizedPhone = adminPhone ? adminPhone.replace(/\D/g, '') : '';

    // Check if phone already exists
    const existingUser = await this.prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existingUser) throw new ConflictException('Ushbu telefon raqami bilan foydalanuvchi allaqachon mavjud');

    branchData.latitude = branchData.latitude ? parseFloat(branchData.latitude) : null;
    branchData.longitude = branchData.longitude ? parseFloat(branchData.longitude) : null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Branch
      const branch = await tx.branch.create({ data: branchData });

      // 2. Create Admin User
      if (adminPhone && adminPassword) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await tx.user.create({
          data: {
            name: adminName || `${branch.name} Admin`,
            phone: normalizedPhone,
            passwordHash,
            role: UserRole.ADMIN,
            branchId: branch.id,
          },
        });
      }

      // 3. Assign Default Subscription Plan
      const defaultPlan = await tx.subscriptionPlan.findFirst({ orderBy: { price: 'asc' } });
      if (defaultPlan) {
        await tx.branchSubscription.create({
          data: {
            branchId: branch.id,
            planId: defaultPlan.id,
            status: 'ACTIVE',
            startDate: new Date(),
            // Set 14 day trial by default if no end date
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return branch;
    });
  }

  async update(id: string, data: any, user?: AuthUserView) {
    await this.findOne(id, user);
    const updateData: any = {
      ...(data.name && { name: data.name }),
      ...(data.address && { address: data.address }),
      ...(data.phone && { phone: data.phone }),
      ...(data.latitude !== undefined && { latitude: data.latitude ? parseFloat(data.latitude) : null }),
      ...(data.longitude !== undefined && { longitude: data.longitude ? parseFloat(data.longitude) : null }),
      ...(data.telegramBotToken !== undefined && { telegramBotToken: data.telegramBotToken }),
      ...(data.eskizEmail !== undefined && { eskizEmail: data.eskizEmail }),
      ...(data.eskizToken !== undefined && { eskizToken: data.eskizToken }),
      ...(data.eskizEnabled !== undefined && { eskizEnabled: data.eskizEnabled }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
    return this.prisma.branch.update({ where: { id }, data: updateData });
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
