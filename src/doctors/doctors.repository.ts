import { Injectable } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { parseDateOnlyToUTC, todayInTashkent } from '../common/utils/date.util';

const USER_PHONE = { user: { select: { phone: true } } } as const;
export type DoctorWithUser = Doctor & { user?: { phone: string } | null };

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.DoctorWhereInput,
    opts?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DoctorOrderByWithRelationInput[];
    },
  ): Promise<{ data: Doctor[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        orderBy: opts?.orderBy ?? { firstName: 'asc' },
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
    // DATE column: clinic calendar day (Asia/Tashkent), not the server's TZ.
    const today = parseDateOnlyToUTC(todayInTashkent());

    const count = await this.prisma.doctor.count({
      where: {
        bookings: {
          some: {
            date: today,
            status: { notIn: ['cancelled', 'no-show'] },
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

  /** `range` limits bookings/visits by their date (inclusive); omitted → all time. */
  async getDetailedEfficiencyStats(range?: { gte?: Date; lte?: Date }) {
    const dateWhere = range && (range.gte || range.lte) ? { date: range } : {};
    // Get all doctors first
    const doctors = await this.prisma.doctor.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialty: true,
        phone: true,
      },
    });

    // Get booking stats per doctor
    const bookingStats = await this.prisma.booking.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      where: {
        status: { in: ['pending', 'confirmed', 'completed'] },
        ...dateWhere,
      },
    });

    // Get visit stats per doctor
    const visitStats = await this.prisma.visit.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      _sum: { price: true },
      where: { status: 'completed', ...dateWhere },
    });

    // Get payment stats (real revenue)
    // Actually using visit price sum for revenue is fine if visits are completed
    // but we can also check payments if needed. Let's stick to visit price as 'potential revenue'
    // and we can cross reference with payments if wanted.
    // For simplicity and business logic: Revenue = Sum(Visit.price where status=completed)

    // Get unique patient counts per doctor
    const uniquePatientStats = await this.prisma.visit.groupBy({
      by: ['doctorId', 'patientId'],
      where: { status: 'completed', ...dateWhere },
    });

    // Completing a booking does not create a Visit, so a doctor's finished
    // bookings without a visit must still count as treated patients / visits.
    const completedBookings = await this.prisma.booking.findMany({
      where: { status: 'completed', visits: { none: {} }, ...dateWhere },
      select: { doctorId: true, patientId: true },
    });

    const doctorUniquePatients = new Map<string, Set<string>>();
    const addPatient = (doctorId: string, patientId: string) => {
      if (!doctorUniquePatients.has(doctorId))
        doctorUniquePatients.set(doctorId, new Set());
      doctorUniquePatients.get(doctorId)!.add(patientId);
    };
    uniquePatientStats.forEach((s) => addPatient(s.doctorId, s.patientId));
    const doctorBookingOnlyVisits = new Map<string, number>();
    completedBookings.forEach((b) => {
      addPatient(b.doctorId, b.patientId);
      doctorBookingOnlyVisits.set(
        b.doctorId,
        (doctorBookingOnlyVisits.get(b.doctorId) ?? 0) + 1,
      );
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
        totalVisits:
          (vStat?._count.id || 0) + (doctorBookingOnlyVisits.get(d.id) ?? 0),
        uniquePatients: doctorUniquePatients.get(d.id)?.size || 0,
        totalRevenue: vStat?._sum.price || 0,
      };
    });
  }

  /** Pending/confirmed bookings from today (Tashkent) on, for schedule-change reports. */
  findActiveFutureBookings(doctorId: string) {
    return this.prisma.booking.findMany({
      where: {
        doctorId,
        status: { in: ['pending', 'confirmed'] },
        date: { gte: parseDateOnlyToUTC(todayInTashkent()) },
      },
      select: {
        date: true,
        time: true,
        service: { select: { duration: true } },
      },
      take: 5000,
    });
  }

  delete(id: string): Promise<Doctor> {
    return this.prisma.doctor.delete({ where: { id } });
  }

  /** Creates the optional login user and the doctor atomically. */
  createWithUser(
    data: Prisma.DoctorCreateInput,
    user: Prisma.UserCreateInput | null,
  ): Promise<DoctorWithUser> {
    return this.prisma.$transaction(async (tx) => {
      let doctorData = data;
      if (user) {
        const u = await tx.user.create({ data: user, select: { id: true } });
        doctorData = { ...data, user: { connect: { id: u.id } } };
      }
      return tx.doctor.create({ data: doctorData, include: USER_PHONE });
    });
  }

  /** Updates the doctor and creates/updates its login user atomically. */
  updateWithUser(
    id: string,
    data: Prisma.DoctorUpdateInput,
    user:
      | { create: Prisma.UserCreateInput }
      | { update: { id: string; data: Prisma.UserUpdateInput } }
      | null,
  ): Promise<DoctorWithUser> {
    return this.prisma.$transaction(async (tx) => {
      let doctorData = data;
      if (user && 'create' in user) {
        const u = await tx.user.create({
          data: user.create,
          select: { id: true },
        });
        doctorData = { ...data, user: { connect: { id: u.id } } };
      } else if (user && 'update' in user) {
        await tx.user.update({
          where: { id: user.update.id },
          data: user.update.data,
        });
      }
      return tx.doctor.update({
        where: { id },
        data: doctorData,
        include: USER_PHONE,
      });
    });
  }

  /** Deletes the doctor and its login user in one transaction. */
  async deleteWithUser(id: string, userId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.doctor.delete({ where: { id } });
      if (userId) await tx.user.delete({ where: { id: userId } });
    });
  }

  /** Bookings/visits reference doctors with onDelete: Restrict. */
  async countHistory(
    id: string,
  ): Promise<{ bookings: number; visits: number }> {
    const [bookings, visits] = await Promise.all([
      this.prisma.booking.count({ where: { doctorId: id } }),
      this.prisma.visit.count({ where: { doctorId: id } }),
    ]);
    return { bookings, visits };
  }
}
