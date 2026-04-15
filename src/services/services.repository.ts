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
      _avg: { price: true },
    });
    return Math.round(result._avg.price || 0);
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

  delete(id: string): Promise<Service> {
    return this.prisma.service.delete({ where: { id } });
  }
}
