import { Injectable } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.DoctorWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: any[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where: { ...where, deletedAt: null },
        include: { 
          user: true,
          availabilities: true,
        },
        orderBy: { user: { name: 'asc' } },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.doctor.count({ where: { ...where, deletedAt: null } }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.DoctorWhereInput): Promise<number> {
    return this.prisma.doctor.count({ where: { ...where, deletedAt: null } });
  }

  async getActiveCountToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const count = await this.prisma.doctor.count({
      where: {
        bookings: {
          some: {
            startTime: { gte: today, lt: tomorrow },
            status: { not: 'CANCELLED' },
          },
        },
        deletedAt: null,
      },
    });
    return { count };
  }

  async getTotalVisitsCount() {
    const count = await this.prisma.visit.count();
    return { count };
  }

  findById(id: string) {
    return this.prisma.doctor.findUnique({
      where: { id },
      include: { 
        user: true,
        availabilities: true,
      },
    });
  }

  create(data: Prisma.DoctorCreateInput) {
    return this.prisma.doctor.create({
      data,
      include: { user: true, availabilities: true },
    });
  }

  update(id: string, data: Prisma.DoctorUpdateInput) {
    return this.prisma.doctor.update({
      where: { id },
      data,
      include: { user: true, availabilities: true },
    });
  }

  async getDetailedEfficiencyStats() {
    const doctors = await this.prisma.doctor.findMany({
      where: { deletedAt: null },
      include: { user: true }
    });

    const bookingStats = await this.prisma.booking.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      where: { status: { not: 'CANCELLED' }, deletedAt: null },
    });

    const visitStats = await this.prisma.visit.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      _sum: { price: true },
    });

    const uniquePatientStats = await this.prisma.visit.groupBy({
      by: ['doctorId', 'patientId'],
    });

    const doctorUniquePatients = new Map<string, Set<string>>();
    uniquePatientStats.forEach((s) => {
      if (!doctorUniquePatients.has(s.doctorId))
        doctorUniquePatients.set(s.doctorId, new Set());
      doctorUniquePatients.get(s.doctorId)!.add(s.patientId);
    });

    return doctors.map((d) => {
      const bStat = bookingStats.find((s) => s.doctorId === d.id);
      const vStat = visitStats.find((s) => s.doctorId === d.id);

      return {
        id: d.id,
        name: d.user.name,
        specialty: d.specialty,
        phone: d.phone,
        totalBookings: bStat?._count.id || 0,
        totalVisits: vStat?._count.id || 0,
        uniquePatients: doctorUniquePatients.get(d.id)?.size || 0,
        totalRevenue: vStat?._sum.price?.toNumber() || 0,
      };
    });
  }

  softDelete(id: string): Promise<Doctor> {
    return this.prisma.doctor.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
