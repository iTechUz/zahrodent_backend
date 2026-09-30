import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { debtSummarySql } from '../patients/patient-balance';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countPatients(where: Prisma.PatientWhereInput) {
    return this.prisma.patient.count({ where });
  }

  countBookings(where: Prisma.BookingWhereInput) {
    return this.prisma.booking.count({ where });
  }

  countDoctors(where: Prisma.DoctorWhereInput = {}) {
    return this.prisma.doctor.count({ where });
  }

  async sumPayments(where: Prisma.PaymentWhereInput): Promise<number> {
    const r = await this.prisma.payment.aggregate({
      where,
      _sum: { amount: true },
    });
    return r._sum.amount ?? 0;
  }

  async getDebtSummary(): Promise<{ total: number; count: number }> {
    const rows =
      await this.prisma.$queryRaw<{ total: number; count: number }[]>(
        debtSummarySql,
      );
    return {
      total: Number(rows[0]?.total ?? 0),
      count: Number(rows[0]?.count ?? 0),
    };
  }

  /** Per-day patient counts (created_at is a DATE column). */
  async patientsPerDay(where: Prisma.PatientWhereInput) {
    const rows = await this.prisma.patient.groupBy({
      by: ['createdAt'],
      where,
      _count: { _all: true },
    });
    return rows.map((r) => ({ date: r.createdAt, count: r._count._all }));
  }

  async bookingsPerDayAndStatus(where: Prisma.BookingWhereInput) {
    const rows = await this.prisma.booking.groupBy({
      by: ['date', 'status'],
      where,
      _count: { _all: true },
    });
    return rows.map((r) => ({
      date: r.date,
      status: r.status,
      count: r._count._all,
    }));
  }

  async paymentsPerDayAndType(where: Prisma.PaymentWhereInput) {
    const rows = await this.prisma.payment.groupBy({
      by: ['date', 'type'],
      where,
      _sum: { amount: true },
    });
    return rows.map((r) => ({
      date: r.date,
      type: r.type,
      amount: r._sum.amount ?? 0,
    }));
  }

  async bookingsBySource(where: Prisma.BookingWhereInput) {
    const rows = await this.prisma.booking.groupBy({
      by: ['source'],
      where,
      _count: { _all: true },
    });
    return rows.map((r) => ({ source: r.source, count: r._count._all }));
  }

  async patientsBySource(where: Prisma.PatientWhereInput) {
    const rows = await this.prisma.patient.groupBy({
      by: ['source'],
      where,
      _count: { _all: true },
    });
    return rows.map((r) => ({ source: r.source, count: r._count._all }));
  }
}
