import { Injectable } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.DoctorWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Doctor[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        orderBy: { firstName: 'asc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.doctor.count({ where }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.DoctorWhereInput): Promise<number> {
    return this.prisma.doctor.count({ where });
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
            date: { gte: today, lt: tomorrow },
          },
        },
      },
    });
    return { count };
  }

  async getTotalVisitsCount() {
    const count = await this.prisma.visit.count();
    return { count };
  }

  findById(
    id: string,
  ): Promise<(Doctor & { user?: { phone: string } | null }) | null> {
    return this.prisma.doctor.findUnique({
      where: { id },
      include: { user: { select: { phone: true } } },
    });
  }

  create(
    data: Prisma.DoctorCreateInput,
  ): Promise<Doctor & { user?: { phone: string } | null }> {
    return this.prisma.doctor.create({
      data,
      include: { user: { select: { phone: true } } },
    });
  }

  update(
    id: string,
    data: Prisma.DoctorUpdateInput,
  ): Promise<Doctor & { user?: { phone: string } | null }> {
    return this.prisma.doctor.update({
      where: { id },
      data,
      include: { user: { select: { phone: true } } },
    });
  }

  async getDetailedEfficiencyStats() {
    // Get all doctors first
    const doctors = await this.prisma.doctor.findMany({
      select: { 
        id: true, 
        firstName: true, 
        lastName: true, 
        specialty: true,
        phone: true 
      },
    });

    // Get booking stats per doctor
    const bookingStats = await this.prisma.booking.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      where: { status: { in: ['pending', 'confirmed', 'completed'] } },
    });

    // Get visit stats per doctor
    const visitStats = await this.prisma.visit.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      _sum: { price: true },
      where: { status: 'completed' },
    });

    // Get payment stats (real revenue)
    // Actually using visit price sum for revenue is fine if visits are completed
    // but we can also check payments if needed. Let's stick to visit price as 'potential revenue'
    // and we can cross reference with payments if wanted.
    // For simplicity and business logic: Revenue = Sum(Visit.price where status=completed)

    // Get unique patient counts per doctor
    const uniquePatientStats = await this.prisma.visit.groupBy({
      by: ['doctorId', 'patientId'],
      where: { status: 'completed' },
    });

    const doctorUniquePatients = new Map<string, Set<string>>();
    uniquePatientStats.forEach(s => {
      if (!doctorUniquePatients.has(s.doctorId)) doctorUniquePatients.set(s.doctorId, new Set());
      doctorUniquePatients.get(s.doctorId)!.add(s.patientId);
    });

    return doctors.map((d) => {
      const bStat = bookingStats.find((s) => s.doctorId === d.id);
      const vStat = visitStats.find((s) => s.doctorId === d.id);

      return {
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        specialty: d.specialty,
        phone: d.phone,
        totalBookings: bStat?._count.id || 0,
        totalVisits: vStat?._count.id || 0,
        uniquePatients: doctorUniquePatients.get(d.id)?.size || 0,
        totalRevenue: vStat?._sum.price || 0,
      };
    });
  }

  delete(id: string): Promise<Doctor> {
    return this.prisma.doctor.delete({ where: { id } });
  }
}
