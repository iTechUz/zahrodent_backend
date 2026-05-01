import { Injectable } from '@nestjs/common';
import { Prisma, Service } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.ServiceWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Service[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.service.count({ where }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.ServiceWhereInput): Promise<number> {
    return this.prisma.service.count({ where });
  }

  async countCategories(): Promise<number> {
    const result = await this.prisma.service.groupBy({
      by: ['category'],
    });
    return result.length;
  }

  async getAvgPrice(): Promise<number> {
    const result = await this.prisma.service.aggregate({
      _avg: { basePrice: true },
    });
    return Math.round(result._avg.basePrice?.toNumber() || 0);
  }

  findById(id: string): Promise<Service | null> {
    return this.prisma.service.findUnique({ where: { id } });
  }

  create(data: Prisma.ServiceCreateInput): Promise<Service> {
    return this.prisma.service.create({ data });
  }

  update(id: string, data: Prisma.ServiceUpdateInput): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data });
  }

  async getDetailedStats() {
    const paymentStats = await this.prisma.payment.groupBy({
      by: ['serviceId'],
      where: { status: 'COMPLETED', serviceId: { not: null } },
      _sum: { amount: true },
      _count: { patientId: true }, 
    });

    const patientStatsRaw = await this.prisma.payment.groupBy({
      by: ['serviceId', 'patientId'],
      where: { serviceId: { not: null } },
    });

    const servicePatientCount = new Map<string, Set<string>>();
    patientStatsRaw.forEach((r) => {
      if (!r.serviceId) return;
      if (!servicePatientCount.has(r.serviceId))
        servicePatientCount.set(r.serviceId, new Set());
      servicePatientCount.get(r.serviceId)!.add(r.patientId);
    });

    return paymentStats.map((s) => ({
      serviceId: s.serviceId!,
      revenue: s._sum.amount?.toNumber() || 0,
      patientCount: servicePatientCount.get(s.serviceId!)?.size || 0,
    }));
  }

  delete(id: string): Promise<Service> {
    return this.prisma.service.delete({ where: { id } });
  }
}
