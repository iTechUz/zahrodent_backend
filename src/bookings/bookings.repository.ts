import { Injectable } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.BookingWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Booking[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { ...where, deletedAt: null },
        orderBy: [{ startTime: 'desc' }],
        include: {
          patient: true,
          doctor: { include: { user: true } },
          service: true,
        },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.booking.count({ where: { ...where, deletedAt: null } }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.BookingWhereInput): Promise<number> {
    return this.prisma.booking.count({ where: { ...where, deletedAt: null } });
  }

  findById(id: string): Promise<Booking | null> {
    return this.prisma.booking.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        service: true,
      },
    });
  }

  findServiceById(id: string) {
    return this.prisma.service.findUnique({ where: { id } });
  }

  findManyWithService(where: Prisma.BookingWhereInput) {
    return this.prisma.booking.findMany({
      where: { ...where, deletedAt: null },
      include: { service: true },
    });
  }

  create(data: Prisma.BookingCreateInput): Promise<Booking> {
    return this.prisma.booking.create({ data });
  }

  update(id: string, data: Prisma.BookingUpdateInput): Promise<Booking> {
    return this.prisma.booking.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Booking> {
    return this.prisma.booking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
