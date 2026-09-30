import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import type { AuthUserView } from '../auth/auth.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: jest.Mocked<
    Pick<
      AnalyticsRepository,
      | 'countPatients'
      | 'countBookings'
      | 'countDoctors'
      | 'sumPayments'
      | 'getDebtSummary'
      | 'patientsPerDay'
      | 'bookingsPerDayAndStatus'
      | 'paymentsPerDayAndType'
      | 'patientsBySource'
      | 'bookingsBySource'
    >
  >;

  const admin: AuthUserView = {
    id: 'u1',
    name: 'A',
    phone: 'p',
    role: 'admin',
  };
  const receptionist: AuthUserView = { ...admin, role: 'receptionist' };
  const doctor: AuthUserView = {
    id: 'u2',
    name: 'Dr',
    phone: 'p2',
    role: 'doctor',
    doctorId: 'd1',
  };
  // Soft-deleted patients are always excluded.
  const ND = { deletedAt: null };
  const doctorPatients = {
    AND: [
      ND,
      {
        OR: [
          { assignedDoctorId: 'd1' },
          { bookings: { some: { doctorId: 'd1' } } },
          { visits: { some: { doctorId: 'd1' } } },
        ],
      },
    ],
  };
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

  beforeEach(() => {
    repo = {
      countPatients: jest.fn().mockResolvedValue(0),
      countBookings: jest.fn().mockResolvedValue(0),
      countDoctors: jest.fn().mockResolvedValue(0),
      sumPayments: jest.fn().mockResolvedValue(0),
      getDebtSummary: jest.fn().mockResolvedValue({ total: 0, count: 0 }),
      patientsPerDay: jest.fn().mockResolvedValue([]),
      bookingsPerDayAndStatus: jest.fn().mockResolvedValue([]),
      paymentsPerDayAndType: jest.fn().mockResolvedValue([]),
      patientsBySource: jest.fn().mockResolvedValue([]),
      bookingsBySource: jest.fn().mockResolvedValue([]),
    };
    service = new AnalyticsService(repo as unknown as AnalyticsRepository);
  });

  afterEach(() => jest.useRealTimers());

  describe('getDashboard', () => {
    it('admin — barcha maydonlar, pul faqat INCOME/EXPENSE paid|partial', async () => {
      repo.countPatients.mockResolvedValueOnce(120).mockResolvedValueOnce(14);
      repo.countBookings
        .mockResolvedValueOnce(9)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(11);
      repo.countDoctors.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
      repo.sumPayments
        .mockResolvedValueOnce(1_500_000)
        .mockResolvedValueOnce(42_000_000)
        .mockResolvedValueOnce(8_000_000);
      repo.getDebtSummary.mockResolvedValue({ total: 3_200_000, count: 7 });

      await expect(service.getDashboard(admin, '2026-09-15')).resolves.toEqual({
        totalPatients: 120,
        newPatientsThisMonth: 14,
        todayBookings: 9,
        todayCompleted: 4,
        pendingBookings: 11,
        activeDoctors: 3,
        totalDoctors: 5,
        todayRevenue: 1_500_000,
        monthRevenue: 42_000_000,
        monthExpenses: 8_000_000,
        unpaidTotal: 3_200_000,
        unpaidCount: 7,
      });

      const month = { gte: d('2026-09-01'), lte: d('2026-09-30') };
      const collected = { in: ['paid', 'partial'] };
      expect(repo.countPatients).toHaveBeenNthCalledWith(1, ND);
      expect(repo.countPatients).toHaveBeenNthCalledWith(2, {
        AND: [ND, { createdAt: month }],
      });
      expect(repo.countBookings).toHaveBeenNthCalledWith(1, {
        date: d('2026-09-15'),
      });
      expect(repo.countBookings).toHaveBeenNthCalledWith(2, {
        date: d('2026-09-15'),
        status: 'completed',
      });
      expect(repo.countBookings).toHaveBeenNthCalledWith(3, {
        status: 'pending',
      });
      expect(repo.countDoctors).toHaveBeenNthCalledWith(1, {
        bookings: { some: { date: d('2026-09-15') } },
      });
      expect(repo.sumPayments).toHaveBeenNthCalledWith(1, {
        type: 'INCOME',
        status: collected,
        date: d('2026-09-15'),
      });
      expect(repo.sumPayments).toHaveBeenNthCalledWith(2, {
        type: 'INCOME',
        status: collected,
        date: month,
      });
      expect(repo.sumPayments).toHaveBeenNthCalledWith(3, {
        type: 'EXPENSE',
        status: collected,
        date: month,
      });
    });

    it('date berilmasa — bugun Asia/Tashkent bo‘yicha', async () => {
      // 2026-09-30 20:00Z = 2026-10-01 01:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-09-30T20:00:00.000Z') });
      await service.getDashboard(admin);
      expect(repo.countBookings).toHaveBeenNthCalledWith(1, {
        date: d('2026-10-01'),
      });
      expect(repo.countPatients).toHaveBeenNthCalledWith(2, {
        AND: [
          ND,
          { createdAt: { gte: d('2026-10-01'), lte: d('2026-10-31') } },
        ],
      });
    });

    it.each([
      ['receptionist', receptionist],
      ['doctor', doctor],
    ])('%s — pul maydonlari null, pul so‘rovlari yo‘q', async (_n, user) => {
      const out = await service.getDashboard(user, '2026-09-15');
      expect(out).toMatchObject({
        todayRevenue: null,
        monthRevenue: null,
        monthExpenses: null,
        unpaidTotal: null,
        unpaidCount: null,
      });
      expect(repo.sumPayments).not.toHaveBeenCalled();
      expect(repo.getDebtSummary).not.toHaveBeenCalled();
    });

    it('doctor — bemor va qabullar o‘ziniki bilan cheklanadi', async () => {
      await service.getDashboard(doctor, '2026-09-15');
      expect(repo.countPatients).toHaveBeenNthCalledWith(1, doctorPatients);
      expect(repo.countBookings).toHaveBeenNthCalledWith(1, {
        doctorId: 'd1',
        date: d('2026-09-15'),
      });
      expect(repo.countBookings).toHaveBeenNthCalledWith(3, {
        doctorId: 'd1',
        status: 'pending',
      });
    });

    it('doctor profili yo‘q — 403', async () => {
      await expect(
        service.getDashboard({ ...doctor, doctorId: undefined }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.countPatients).not.toHaveBeenCalled();
    });
  });

  describe('getMonthly', () => {
    const now = new Date('2026-09-10T08:00:00.000Z');

    it('oxirgi N oy, eskidan yangiga, bo‘sh oylar 0 bilan', async () => {
      repo.patientsPerDay.mockResolvedValue([
        { date: d('2026-07-03'), count: 2 },
        { date: d('2026-09-01'), count: 1 },
        { date: d('2026-09-09'), count: 4 },
      ]);
      repo.bookingsPerDayAndStatus.mockResolvedValue([
        { date: d('2026-09-02'), status: 'completed', count: 3 },
        { date: d('2026-09-02'), status: 'pending', count: 2 },
        { date: d('2026-08-31'), status: 'cancelled', count: 1 },
      ]);
      repo.paymentsPerDayAndType.mockResolvedValue([
        { date: d('2026-09-02'), type: 'INCOME', amount: 500 },
        { date: d('2026-09-05'), type: 'INCOME', amount: 250 },
        { date: d('2026-09-05'), type: 'EXPENSE', amount: 100 },
      ]);

      const out = await service.getMonthly(admin, 3, now);
      expect(out).toEqual([
        {
          month: '2026-07',
          newPatients: 2,
          bookings: 0,
          completedBookings: 0,
          revenue: 0,
          expenses: 0,
        },
        {
          month: '2026-08',
          newPatients: 0,
          bookings: 1,
          completedBookings: 0,
          revenue: 0,
          expenses: 0,
        },
        {
          month: '2026-09',
          newPatients: 5,
          bookings: 5,
          completedBookings: 3,
          revenue: 750,
          expenses: 100,
        },
      ]);
      const range = { gte: d('2026-07-01'), lte: d('2026-09-30') };
      expect(repo.patientsPerDay).toHaveBeenCalledWith({
        AND: [ND, { createdAt: range }],
      });
      expect(repo.bookingsPerDayAndStatus).toHaveBeenCalledWith({
        date: range,
      });
      expect(repo.paymentsPerDayAndType).toHaveBeenCalledWith({
        status: { in: ['paid', 'partial'] },
        date: range,
      });
    });

    it('yil chegarasidan o‘tadi (fevral → oldingi yil dekabr)', async () => {
      const out = await service.getMonthly(
        admin,
        3,
        new Date('2027-02-01T00:00:00.000Z'),
      );
      expect(out.map((p) => p.month)).toEqual([
        '2026-12',
        '2027-01',
        '2027-02',
      ]);
    });

    it('doctor — scope bilan, revenue/expenses null, to‘lovlar so‘ralmaydi', async () => {
      const out = await service.getMonthly(doctor, 1, now);
      expect(out).toEqual([
        {
          month: '2026-09',
          newPatients: 0,
          bookings: 0,
          completedBookings: 0,
          revenue: null,
          expenses: null,
        },
      ]);
      expect(repo.patientsPerDay).toHaveBeenCalledWith({
        AND: [doctorPatients, expect.any(Object)],
      });
      expect(repo.bookingsPerDayAndStatus).toHaveBeenCalledWith(
        expect.objectContaining({ doctorId: 'd1' }),
      );
      expect(repo.paymentsPerDayAndType).not.toHaveBeenCalled();
    });

    it('24 oy — 24 ta nuqta', async () => {
      await expect(service.getMonthly(admin, 24, now)).resolves.toHaveLength(
        24,
      );
    });
  });

  describe('getSources', () => {
    it('standart — qabullar manba bo‘yicha, ko‘pdan kamga', async () => {
      repo.bookingsBySource.mockResolvedValue([
        { source: 'walk-in', count: 3 },
        { source: 'telegram', count: 10 },
        { source: 'phone', count: 3 },
      ]);
      await expect(service.getSources(admin)).resolves.toEqual([
        { source: 'telegram', count: 10 },
        { source: 'phone', count: 3 },
        { source: 'walk-in', count: 3 },
      ]);
      expect(repo.bookingsBySource).toHaveBeenCalledWith({});
      expect(repo.patientsBySource).not.toHaveBeenCalled();
    });

    it('doctor — faqat o‘z qabullari', async () => {
      await service.getSources(doctor);
      expect(repo.bookingsBySource).toHaveBeenCalledWith({ doctorId: 'd1' });
    });

    it('type=patients — bemorlar manbasi (doctor scope bilan)', async () => {
      repo.patientsBySource.mockResolvedValue([
        { source: 'website', count: 2 },
      ]);
      await expect(service.getSources(doctor, 'patients')).resolves.toEqual([
        { source: 'website', count: 2 },
      ]);
      expect(repo.patientsBySource).toHaveBeenCalledWith(doctorPatients);
      expect(repo.bookingsBySource).not.toHaveBeenCalled();
    });
  });
});
