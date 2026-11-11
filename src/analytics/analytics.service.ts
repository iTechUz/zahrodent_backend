import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AnalyticsRepository } from './analytics.repository';
import { AuthUserView } from '../auth/auth.service';
import {
  doctorPatientsWhere,
  doctorScopeId,
} from '../common/auth/doctor-scope';
import {
  addDaysToDateOnly,
  addMonthsToMonthKey,
  dateOnlyColumnRange,
  monthBoundsOf,
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { COLLECTED_PAYMENT_STATUSES } from '../patients/patient-balance';
import {
  DailyPointDto,
  DashboardResponseDto,
  MonthlyPointDto,
  SourcePointDto,
} from './dto/analytics-response.dto';
import type { SourceType } from './dto/analytics-query.dto';

const COLLECTED = { in: [...COLLECTED_PAYMENT_STATUSES] };
const MAX_DAILY_DAYS = 92;

/** Whole months from `YYYY-MM` a to b (b ≥ a → ≥ 0). */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** Whole days from `YYYY-MM-DD` a to b. */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseDateOnlyToUTC(b).getTime() - parseDateOnlyToUTC(a).getTime()) /
      86_400_000,
  );
}

/**
 * Definitions used by every dashboard number (keep screens consistent):
 *  - "bookings" (load: dashboard todayBookings, active doctors) = bookings
 *    that are not cancelled / no-show; the funnel series (monthly/daily
 *    `bookings`, sources) count ALL statuses next to `completedBookings`.
 *  - Bookings of soft-deleted (archived) patients never count anywhere.
 *  - "revenue" = collected (paid|partial) INCOME payments by payment date,
 *    including payments of archived patients (the money really came in);
 *    EXPENSE is reported separately and is never mixed into revenue.
 *  - "unpaid" = debt of non-deleted patients only (patient-balance.ts); the
 *    debt of an archived patient leaves it, which is why archiving a debtor
 *    needs an explicit confirmation (DELETE /patients/:id?force=true).
 */

/**
 * Clinic dashboard numbers. Doctors see only their own patients/bookings;
 * money fields are admin-only (null for everybody else).
 *
 * Period rule shared by every series (dashboard month figures, monthly, daily,
 * sources): when a period is given and `endDate` is omitted, the upper bound
 * is today (Asia/Tashkent) — bookings, money and new patients alike. No period
 * at all: dashboard/monthly/daily use their own default window, sources are
 * all-time.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  private scopes(user: AuthUserView) {
    const doctorId = doctorScopeId(user);
    return {
      // Soft-deleted patients never count.
      patients: (doctorId
        ? { AND: [{ deletedAt: null }, doctorPatientsWhere(doctorId)] }
        : { deletedAt: null }) as Prisma.PatientWhereInput,
      // Bookings of archived patients are excluded, like the patients themselves.
      bookings: {
        ...(doctorId ? { doctorId } : {}),
        patient: { deletedAt: null },
      } as Prisma.BookingWhereInput,
      canSeeMoney: user.role === 'admin',
    };
  }

  async getDashboard(
    user: AuthUserView,
    date: string = todayInTashkent(),
    period: { startDate?: string; endDate?: string } = {},
  ): Promise<DashboardResponseDto> {
    const scope = this.scopes(user);
    const day = parseDateOnlyToUTC(date);
    // "month" figures cover the requested period; without one — the month of `date`
    let monthRange: { gte?: Date; lte?: Date };
    if (period.startDate || period.endDate) {
      const start = period.startDate;
      const end = period.endDate ?? date;
      if (start && start > end) {
        throw new BadRequestException(
          'startDate endDate dan keyin bo‘lishi mumkin emas',
        );
      }
      monthRange = dateOnlyColumnRange(start, end);
    } else {
      const month = monthBoundsOf(date);
      monthRange = dateOnlyColumnRange(month.start, month.end);
    }

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
      // Cancelled / no-show slots are not "today's bookings".
      this.repo.countBookings({
        ...scope.bookings,
        date: day,
        status: { notIn: ['cancelled', 'no-show'] },
      }),
      this.repo.countBookings({
        ...scope.bookings,
        date: day,
        status: 'completed',
      }),
      // Only still-upcoming pending bookings (today onwards), not stale ones.
      this.repo.countBookings({
        ...scope.bookings,
        status: 'pending',
        date: { gte: day },
      }),
      this.repo.countDoctors({
        bookings: {
          some: {
            date: day,
            status: { notIn: ['cancelled', 'no-show'] },
            patient: { deletedAt: null },
          },
        },
      }),
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

  /**
   * Last `months` calendar months (current included), oldest → newest.
   * With a `period` — the calendar months from its start to its end (at most
   * the last 24); only rows inside the period are counted.
   */
  async getMonthly(
    user: AuthUserView,
    months = 6,
    now: Date = new Date(),
    period: { startDate?: string; endDate?: string } = {},
  ): Promise<MonthlyPointDto[]> {
    const scope = this.scopes(user);
    const today = todayInTashkent(now);
    let keys: string[];
    let range: { gte?: Date; lte?: Date };
    if (period.startDate || period.endDate) {
      const end = period.endDate ?? today;
      this.assertPeriod(period.startDate, end);
      const endKey = end.slice(0, 7);
      const startKey = (period.startDate ?? `${endKey}-01`).slice(0, 7);
      const count = Math.min(24, monthsBetween(startKey, endKey) + 1);
      keys = Array.from({ length: count }, (_, i) =>
        addMonthsToMonthKey(endKey, i - (count - 1)),
      );
      const from =
        period.startDate && period.startDate.slice(0, 7) === keys[0]
          ? period.startDate
          : `${keys[0]}-01`;
      range = dateOnlyColumnRange(from, end);
    } else {
      const currentMonth = today.slice(0, 7);
      keys = Array.from({ length: months }, (_, i) =>
        addMonthsToMonthKey(currentMonth, i - (months - 1)),
      );
      range = dateOnlyColumnRange(
        `${keys[0]}-01`,
        monthBoundsOf(`${currentMonth}-01`).end,
      );
    }

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

  /** Per-day series for `startDate`..`endDate` (default: this month so far), empty days included. */
  async getDaily(
    user: AuthUserView,
    period: { startDate?: string; endDate?: string } = {},
    now: Date = new Date(),
  ): Promise<DailyPointDto[]> {
    const scope = this.scopes(user);
    const today = todayInTashkent(now);
    const end = period.endDate ?? today;
    const start = period.startDate ?? `${end.slice(0, 7)}-01`;
    this.assertPeriod(start, end);
    const days = daysBetween(start, end) + 1;
    if (days > MAX_DAILY_DAYS) {
      throw new BadRequestException(
        `Kunlik dinamika ko‘pi bilan ${MAX_DAILY_DAYS} kun uchun`,
      );
    }
    const range = dateOnlyColumnRange(start, end);

    const [patients, bookings, payments] = await Promise.all([
      this.repo.patientsPerDay({
        AND: [scope.patients, { createdAt: range }],
      }),
      this.repo.bookingsPerDayAndStatus({ ...scope.bookings, date: range }),
      scope.canSeeMoney
        ? this.repo.paymentsPerDayAndType({ status: COLLECTED, date: range })
        : Promise.resolve([]),
    ]);

    const keys = Array.from({ length: days }, (_, i) =>
      addDaysToDateOnly(start, i),
    );
    const points = new Map<string, DailyPointDto>(
      keys.map((date) => [
        date,
        {
          date,
          newPatients: 0,
          bookings: 0,
          completedBookings: 0,
          revenue: scope.canSeeMoney ? 0 : null,
          expenses: scope.canSeeMoney ? 0 : null,
        },
      ]),
    );
    const at = (d: Date) => points.get(toDateOnlyString(d));

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

  private assertPeriod(start: string | undefined, end: string) {
    if (start && start > end) {
      throw new BadRequestException(
        'startDate endDate dan keyin bo‘lishi mumkin emas',
      );
    }
  }

  /** Bookings (default) or patients grouped by source, most frequent first. */
  async getSources(
    user: AuthUserView,
    type: SourceType = 'bookings',
    period: { startDate?: string; endDate?: string } = {},
  ): Promise<SourcePointDto[]> {
    const scope = this.scopes(user);
    const hasPeriod = !!(period.startDate || period.endDate);
    const end = period.endDate ?? todayInTashkent();
    if (hasPeriod) this.assertPeriod(period.startDate, end);
    const range = dateOnlyColumnRange(period.startDate, end);
    const rows =
      type === 'patients'
        ? await this.repo.patientsBySource(
            hasPeriod
              ? { AND: [scope.patients, { createdAt: range }] }
              : scope.patients,
          )
        : await this.repo.bookingsBySource(
            hasPeriod ? { ...scope.bookings, date: range } : scope.bookings,
          );
    return rows
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
      .map((r) => ({ source: r.source, count: r.count }));
  }
}
