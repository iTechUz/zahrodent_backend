import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AnalyticsRepository } from './analytics.repository';
import { AuthUserView } from '../auth/auth.service';
import {
  doctorPatientsWhere,
  doctorScopeId,
} from '../common/auth/doctor-scope';
import {
  addMonthsToMonthKey,
  dateOnlyColumnRange,
  monthBoundsOf,
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { COLLECTED_PAYMENT_STATUSES } from '../patients/patient-balance';
import {
  DashboardResponseDto,
  MonthlyPointDto,
  SourcePointDto,
} from './dto/analytics-response.dto';
import type { SourceType } from './dto/analytics-query.dto';

const COLLECTED = { in: [...COLLECTED_PAYMENT_STATUSES] };

/**
 * Clinic dashboard numbers. Doctors see only their own patients/bookings;
 * money fields are admin-only (null for everybody else).
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  private scopes(user: AuthUserView) {
    const doctorId = doctorScopeId(user);
    return {
      patients: (doctorId
        ? doctorPatientsWhere(doctorId)
        : {}) as Prisma.PatientWhereInput,
      bookings: (doctorId ? { doctorId } : {}) as Prisma.BookingWhereInput,
      canSeeMoney: user.role === 'admin',
    };
  }

  async getDashboard(
    user: AuthUserView,
    date: string = todayInTashkent(),
  ): Promise<DashboardResponseDto> {
    const scope = this.scopes(user);
    const day = parseDateOnlyToUTC(date);
    const month = monthBoundsOf(date);
    const monthRange = dateOnlyColumnRange(month.start, month.end);

    const [
      totalPatients,
      newPatientsThisMonth,
      todayBookings,
      todayCompleted,
      pendingBookings,
      activeDoctors,
      totalDoctors,
    ] = await Promise.all([
      this.repo.countPatients(scope.patients),
      this.repo.countPatients({
        AND: [scope.patients, { createdAt: monthRange }],
      }),
      this.repo.countBookings({ ...scope.bookings, date: day }),
      this.repo.countBookings({
        ...scope.bookings,
        date: day,
        status: 'completed',
      }),
      this.repo.countBookings({ ...scope.bookings, status: 'pending' }),
      this.repo.countDoctors({ bookings: { some: { date: day } } }),
      this.repo.countDoctors(),
    ]);

    let money: Pick<
      DashboardResponseDto,
      | 'todayRevenue'
      | 'monthRevenue'
      | 'monthExpenses'
      | 'unpaidTotal'
      | 'unpaidCount'
    > = {
      todayRevenue: null,
      monthRevenue: null,
      monthExpenses: null,
      unpaidTotal: null,
      unpaidCount: null,
    };

    if (scope.canSeeMoney) {
      const [todayRevenue, monthRevenue, monthExpenses, debt] =
        await Promise.all([
          this.repo.sumPayments({
            type: 'INCOME',
            status: COLLECTED,
            date: day,
          }),
          this.repo.sumPayments({
            type: 'INCOME',
            status: COLLECTED,
            date: monthRange,
          }),
          this.repo.sumPayments({
            type: 'EXPENSE',
            status: COLLECTED,
            date: monthRange,
          }),
          this.repo.getDebtSummary(),
        ]);
      money = {
        todayRevenue,
        monthRevenue,
        monthExpenses,
        unpaidTotal: debt.total,
        unpaidCount: debt.count,
      };
    }

    return {
      totalPatients,
      newPatientsThisMonth,
      todayBookings,
      todayCompleted,
      pendingBookings,
      activeDoctors,
      totalDoctors,
      ...money,
    };
  }

  /** Last `months` calendar months (current included), oldest → newest. */
  async getMonthly(
    user: AuthUserView,
    months = 6,
    now: Date = new Date(),
  ): Promise<MonthlyPointDto[]> {
    const scope = this.scopes(user);
    const currentMonth = todayInTashkent(now).slice(0, 7);
    const keys = Array.from({ length: months }, (_, i) =>
      addMonthsToMonthKey(currentMonth, i - (months - 1)),
    );
    const range = dateOnlyColumnRange(
      `${keys[0]}-01`,
      monthBoundsOf(`${currentMonth}-01`).end,
    );

    const [patients, bookings, payments] = await Promise.all([
      this.repo.patientsPerDay({
        AND: [scope.patients, { createdAt: range }],
      }),
      this.repo.bookingsPerDayAndStatus({ ...scope.bookings, date: range }),
      scope.canSeeMoney
        ? this.repo.paymentsPerDayAndType({ status: COLLECTED, date: range })
        : Promise.resolve([]),
    ]);

    const points = new Map<string, MonthlyPointDto>(
      keys.map((month) => [
        month,
        {
          month,
          newPatients: 0,
          bookings: 0,
          completedBookings: 0,
          revenue: scope.canSeeMoney ? 0 : null,
          expenses: scope.canSeeMoney ? 0 : null,
        },
      ]),
    );
    const at = (d: Date) => points.get(toDateOnlyString(d).slice(0, 7));

    for (const r of patients) {
      const p = at(r.date);
      if (p) p.newPatients += r.count;
    }
    for (const r of bookings) {
      const p = at(r.date);
      if (!p) continue;
      p.bookings += r.count;
      if (r.status === 'completed') p.completedBookings += r.count;
    }
    for (const r of payments) {
      const p = at(r.date);
      if (!p) continue;
      if (r.type === 'INCOME') p.revenue = (p.revenue ?? 0) + r.amount;
      else if (r.type === 'EXPENSE') p.expenses = (p.expenses ?? 0) + r.amount;
    }

    return keys.map((k) => points.get(k)!);
  }

  /** Bookings (default) or patients grouped by source, most frequent first. */
  async getSources(
    user: AuthUserView,
    type: SourceType = 'bookings',
  ): Promise<SourcePointDto[]> {
    const scope = this.scopes(user);
    const rows =
      type === 'patients'
        ? await this.repo.patientsBySource(scope.patients)
        : await this.repo.bookingsBySource(scope.bookings);
    return rows
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
      .map((r) => ({ source: r.source, count: r.count }));
  }
}
