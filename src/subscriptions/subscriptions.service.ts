import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  // ─── Tariflar (Plans) ────────────────────────────────────────────────

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } },
      },
    });
  }

  async createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        price: dto.price,
        features: dto.features,
        isPopular: dto.isPopular ?? false,
      },
    });
  }

  async updatePlan(id: string, dto: Partial<CreatePlanDto>) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Tarif topilmadi');
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.features && { features: dto.features }),
        ...(dto.isPopular !== undefined && { isPopular: dto.isPopular }),
      },
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Tarif topilmadi');
    return this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  // ─── Obunalar (Branch Subscriptions) ─────────────────────────────────

  async getAllSubscriptions() {
    return this.prisma.branchSubscription.findMany({
      include: {
        branch: { select: { id: true, name: true, isActive: true } },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignPlan(dto: AssignPlanDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) throw new NotFoundException('Filial topilmadi');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Tarif topilmadi');

    // Upsert: avvalgi obunani yangilash yoki yangi yaratish
    return this.prisma.branchSubscription.upsert({
      where: { branchId: dto.branchId },
      update: {
        planId: dto.planId,
        status: dto.status ?? SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      create: {
        branchId: dto.branchId,
        planId: dto.planId,
        status: dto.status ?? SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        branch: { select: { id: true, name: true } },
        plan: true,
      },
    });
  }

  async updateSubscriptionStatus(branchId: string, status: SubscriptionStatus) {
    const sub = await this.prisma.branchSubscription.findUnique({ where: { branchId } });
    if (!sub) throw new NotFoundException('Bu filialda obuna topilmadi');
    return this.prisma.branchSubscription.update({
      where: { branchId },
      data: { status },
      include: { plan: true, branch: { select: { id: true, name: true } } },
    });
  }

  async getSubscriptionByBranch(branchId: string) {
    const sub = await this.prisma.branchSubscription.findUnique({
      where: { branchId },
      include: { plan: true, branch: { select: { id: true, name: true } } },
    });
    return sub;
  }

  async getHistory(branchId: string) {
    return this.prisma.subscriptionHistory.findMany({
      where: {
        subscription: {
          branchId,
        },
      },
      include: { plan: true },
      orderBy: { changedAt: 'desc' },
    });
  }

  // ─── Dashboard uchun SaaS Metrikalari ────────────────────────────────

  async getSaasMetrics() {
    const [plans, subscriptions] = await Promise.all([
      this.prisma.subscriptionPlan.findMany(),
      this.prisma.branchSubscription.findMany({
        include: { plan: true, branch: true },
      }),
    ]);

    // SaaS context: ACTIVE and PAST_DUE are generally considered "active" for revenue
    const activeSubs = subscriptions.filter(
      (s) => s.status === 'ACTIVE' || s.status === 'PAST_DUE'
    );
    const pastDueSubs = subscriptions.filter((s) => s.status === 'PAST_DUE');

    const mrr = activeSubs.reduce((acc, s) => acc + Number(s.plan.price), 0);
    const arr = mrr * 12;

    return {
      totalPlans: plans.length,
      activeSubscriptions: activeSubs.length,
      pastDueSubscriptions: pastDueSubs.length,
      mrr,
      arr,
      subscriptions,
    };
  }
}
