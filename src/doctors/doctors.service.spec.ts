import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BREAK_OUTSIDE_MESSAGE,
  BREAK_PAIR_MESSAGE,
  DoctorsService,
  LOGIN_NEEDS_PASSWORD,
} from './doctors.service';
import { DoctorsRepository } from './doctors.repository';
import { PHONE_TAKEN_MESSAGE, UsersService } from '../users/users.service';

describe('DoctorsService', () => {
  let service: DoctorsService;
  let repo: jest.Mocked<
    Pick<
      DoctorsRepository,
      | 'findAll'
      | 'findById'
      | 'create'
      | 'update'
      | 'delete'
      | 'count'
      | 'getActiveCountToday'
      | 'getTotalVisitsCount'
      | 'getDetailedEfficiencyStats'
      | 'createWithUser'
      | 'updateWithUser'
      | 'deleteWithUser'
      | 'countHistory'
      | 'findActiveFutureBookings'
    >
  >;
  let users: jest.Mocked<
    Pick<UsersService, 'buildCreateData' | 'buildUpdateData' | 'revokeSessions'>
  >;

  const doc = (partial: Record<string, unknown> = {}) =>
    ({
      id: 'd1',
      firstName: 'Aziz',
      lastName: 'Karimov',
      specialty: 'Terapevt',
      phone: '+998901112233',
      avatar: null,
      schedule: null,
      daysOff: null,
      isActive: true,
      userId: null,
      user: null,
      ...partial,
    }) as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(doc()),
      update: jest.fn().mockResolvedValue(doc()),
      delete: jest.fn(),
      count: jest.fn(),
      getActiveCountToday: jest.fn(),
      getTotalVisitsCount: jest.fn(),
      getDetailedEfficiencyStats: jest.fn(),
      createWithUser: jest.fn().mockResolvedValue(doc()),
      updateWithUser: jest.fn().mockResolvedValue(doc()),
      findActiveFutureBookings: jest.fn().mockResolvedValue([]),
      deleteWithUser: jest.fn().mockResolvedValue(undefined),
      countHistory: jest.fn().mockResolvedValue({ bookings: 0, visits: 0 }),
    };
    users = {
      buildCreateData: jest.fn(async (d: any) => ({
        name: d.name,
        phone: d.phone,
        role: d.role,
        passwordHash: `hashed:${d.password}`,
      })) as any,
      buildUpdateData: jest.fn(async (_id: string, d: any) => ({
        name: d.name,
      })) as any,
      revokeSessions: jest.fn().mockResolvedValue(1) as any,
    };
    service = new DoctorsService(
      repo as unknown as DoctorsRepository,
      users as unknown as UsersService,
    );
  });

  describe('findAll', () => {
    it('default pagination', async () => {
      await service.findAll({});
      expect(repo.findAll).toHaveBeenCalledWith(
        { isActive: true },
        { skip: 0, take: 10 },
      );
    });

    it('specialty "all" e’tiborsiz, boshqasi filtr', async () => {
      await service.findAll({ specialty: 'all', page: 1, limit: 5 });
      expect(repo.findAll).toHaveBeenLastCalledWith(
        { isActive: true },
        { skip: 5, take: 5 },
      );
      await service.findAll({ specialty: 'Ortoped' });
      expect(repo.findAll.mock.calls[1][0]).toEqual({
        isActive: true,
        specialty: 'Ortoped',
      });
    });

    it('search — ism/familiya', async () => {
      await service.findAll({ search: 'az' });
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        isActive: true,
        OR: [
          { firstName: { contains: 'az', mode: 'insensitive' } },
          { lastName: { contains: 'az', mode: 'insensitive' } },
        ],
      });
    });

    it('bo‘sh search e’tiborsiz', async () => {
      await service.findAll({ search: '  ' });
      expect(repo.findAll.mock.calls[0][0]).toEqual({ isActive: true });
    });

    it('response — loginPhone, null lar undefined', async () => {
      repo.findAll.mockResolvedValue({
        data: [
          doc({
            user: { phone: '+998900000001' },
            schedule: [{ day: 1 }],
            daysOff: ['2026-06-01'],
            avatar: 'a.png',
          }),
          doc({ id: 'd2' }),
        ],
        total: 2,
      });
      const out = await service.findAll({});
      expect(out.total).toBe(2);
      expect(out.data[0]).toEqual({
        id: 'd1',
        firstName: 'Aziz',
        lastName: 'Karimov',
        specialty: 'Terapevt',
        phone: '+998901112233',
        loginPhone: '+998900000001',
        isActive: true,
        avatar: 'a.png',
        schedule: [{ day: 1 }],
        daysOff: ['2026-06-01'],
      });
      expect(out.data[1]).toMatchObject({
        loginPhone: undefined,
        avatar: undefined,
        schedule: undefined,
        daysOff: undefined,
      });
    });
  });

  describe('includeInactive / telefon yashirish', () => {
    it('includeInactive=true — isActive filtri qo‘yilmaydi (admin/receptionist)', async () => {
      await service.findAll({ includeInactive: 'true' }, {
        role: 'admin',
      } as any);
      expect(repo.findAll.mock.calls[0][0]).toEqual({});
    });

    it('doctor roli includeInactive bilan ham nofaollarni ko‘rmaydi', async () => {
      await service.findAll({ includeInactive: 'true' }, {
        role: 'doctor',
        doctorId: 'd1',
      } as any);
      expect(repo.findAll.mock.calls[0][0]).toEqual({ isActive: true });
    });

    it('doctor roli — boshqa shifokorning telefoni yo‘q, o‘zinikini ko‘radi', async () => {
      repo.findAll.mockResolvedValue({
        data: [
          doc({ id: 'd1', user: { phone: '+998900000001' } }),
          doc({ id: 'd2', user: { phone: '+998900000002' } }),
        ],
        total: 2,
      });
      const me = { role: 'doctor', doctorId: 'd1' } as any;
      const out = await service.findAll({}, me);
      expect(out.data[0]).toMatchObject({
        phone: '+998901112233',
        loginPhone: '+998900000001',
      });
      expect(out.data[1].phone).toBeUndefined();
      expect(out.data[1].loginPhone).toBeUndefined();
      repo.findById.mockResolvedValue(doc({ id: 'd2' }));
      const one = await service.findOne('d2', me);
      expect(one.phone).toBeUndefined();
      // receptionist / admin — telefon bor
      const rec = await service.findOne('d2', { role: 'receptionist' } as any);
      expect(rec.phone).toBe('+998901112233');
    });
  });

  describe('findOne', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(
        new NotFoundException('Shifokor topilmadi'),
      );
    });

    it('topilsa response', async () => {
      repo.findById.mockResolvedValue(doc());
      await expect(service.findOne('d1')).resolves.toMatchObject({ id: 'd1' });
    });
  });

  describe('create', () => {
    const dto = {
      firstName: 'Aziz',
      lastName: 'Karimov',
      specialty: 'Terapevt',
      phone: '+998901112233',
    };

    it('parolsiz — user yaratilmaydi', async () => {
      await service.create(dto);
      expect(users.buildCreateData).not.toHaveBeenCalled();
      expect(repo.createWithUser).toHaveBeenCalledWith(
        {
          ...dto,
          avatar: undefined,
          schedule: undefined,
          daysOff: undefined,
        },
        null,
      );
    });

    it('parol bilan — doctor rolidagi user ma’lumoti bitta tranzaksiyaga uzatiladi', async () => {
      const schedule = [
        { day: 1, startTime: '09:00', endTime: '18:00', isWorking: true },
      ];
      await service.create({
        ...dto,
        password: 'secret1',
        avatar: 'a.png',
        schedule,
        daysOff: ['2026-06-01'],
      });
      expect(users.buildCreateData).toHaveBeenCalledWith({
        name: 'Aziz Karimov',
        phone: '+998901112233',
        password: 'secret1',
        role: 'doctor',
        specialty: 'Terapevt',
        avatar: 'a.png',
      });
      expect(repo.createWithUser).toHaveBeenCalledWith(
        expect.objectContaining({ schedule, daysOff: ['2026-06-01'] }),
        {
          name: 'Aziz Karimov',
          phone: '+998901112233',
          role: 'doctor',
          passwordHash: 'hashed:secret1',
        },
      );
    });

    it('telefon band (409) — hech narsa yozilmaydi', async () => {
      users.buildCreateData.mockRejectedValue(new ConflictException('band'));
      await expect(
        service.create({ ...dto, password: 'secret1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createWithUser).not.toHaveBeenCalled();
    });

    // Fixed: user and doctor used to be two separate writes — a failing
    // doctor insert left an orphaned login user. Now both happen inside
    // repo.createWithUser (one $transaction), so the error propagates and
    // nothing is committed.
    it('create — doctor yaratish yiqilsa user ham qaytariladi (bitta tranzaksiya)', async () => {
      repo.createWithUser.mockRejectedValue(new Error('doctor insert failed'));
      await expect(
        service.create({ ...dto, password: 'secret1' }),
      ).rejects.toThrow('doctor insert failed');
      // no separate, non-transactional user write exists anymore
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.createWithUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.updateWithUser).not.toHaveBeenCalled();
    });

    it('jadval/dam olish o‘zgarsa — to‘qnashayotgan faol qabullar soni qaytadi', async () => {
      repo.findById.mockResolvedValue(doc());
      repo.updateWithUser.mockResolvedValue(
        doc({ daysOff: ['2026-06-10'], schedule: null }),
      );
      repo.findActiveFutureBookings.mockResolvedValue([
        {
          date: new Date('2026-06-10T00:00:00Z'),
          time: '10:00',
          service: null,
        },
        {
          date: new Date('2026-06-11T00:00:00Z'),
          time: '10:00',
          service: null,
        },
      ] as any);
      const r: any = await service.update('d1', { daysOff: ['2026-06-10'] });
      expect(r.scheduleConflicts).toBe(1);
      expect(repo.updateWithUser).toHaveBeenCalled();
    });

    it('jadval o‘zgarmasa — scheduleConflicts yo‘q', async () => {
      repo.findById.mockResolvedValue(doc());
      const r: any = await service.update('d1', { specialty: 'X' });
      expect(r).not.toHaveProperty('scheduleConflicts');
      expect(repo.findActiveFutureBookings).not.toHaveBeenCalled();
    });

    it('parolsiz — user tegilmaydi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', { specialty: 'Ortoped' });
      expect(users.buildUpdateData).not.toHaveBeenCalled();
      expect(users.buildCreateData).not.toHaveBeenCalled();
      expect(repo.updateWithUser).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ specialty: 'Ortoped' }),
        null,
        undefined,
      );
      expect(users.revokeSessions).not.toHaveBeenCalled();
    });

    it('parol + mavjud user — yangi ism bilan update (tranzaksiyada)', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', {
        password: 'newpass',
        firstName: 'Bek',
        lastName: 'Aliyev',
        phone: '+998909999999',
      });
      // `phone` — aloqa raqami; login telefoniga TEGILMAYDI.
      expect(users.buildUpdateData).toHaveBeenCalledWith('u5', {
        name: 'Bek Aliyev',
        phone: undefined,
        password: 'newpass',
        specialty: undefined,
        avatar: undefined,
      });
      expect(repo.updateWithUser.mock.calls[0][2]).toEqual({
        update: { id: 'u5', data: { name: 'Bek Aliyev' } },
      });
      // New login password → doctor's sessions are revoked.
      expect(users.revokeSessions).toHaveBeenCalledWith('u5');
    });

    it('parol + mavjud user — faqat bitta ism qismi / telefon berilsa user ismi va login telefoni o‘zgarmaydi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', {
        password: 'newpass',
        firstName: 'Only',
        phone: '+998909999999',
      });
      const arg = users.buildUpdateData.mock.calls[0][1];
      expect(arg.name).toBeUndefined();
      expect(arg.phone).toBeUndefined();
    });

    it('parol + mavjud user — loginPhone aniq yuborilsa login telefoni o‘zgaradi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', {
        password: 'newpass',
        loginPhone: '+998907777777',
      });
      expect(users.buildUpdateData.mock.calls[0][1].phone).toBe(
        '+998907777777',
      );
    });

    it('parolsiz loginPhone — login bor bo‘lsa faqat telefon yangilanadi, sessiya bekor qilinmaydi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', { loginPhone: '+998907777777' });
      expect(users.buildUpdateData).toHaveBeenCalledWith('u5', {
        phone: '+998907777777',
      });
      expect(repo.updateWithUser.mock.calls[0][2]).toEqual({
        update: { id: 'u5', data: { name: undefined } },
      });
      expect(users.revokeSessions).not.toHaveBeenCalled();
    });

    it('parolsiz loginPhone — login yo‘q bo‘lsa 400', async () => {
      repo.findById.mockResolvedValue(doc());
      await expect(
        service.update('d1', { loginPhone: '+998907777777' }),
      ).rejects.toThrow(LOGIN_NEEDS_PASSWORD);
      expect(repo.updateWithUser).not.toHaveBeenCalled();
    });

    it('P2002 (poyga) — toza 409 Uzbek xabar', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      repo.updateWithUser.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.update('d1', {
          password: 'newpass',
          loginPhone: '+998907777777',
        }),
      ).rejects.toThrow(new ConflictException(PHONE_TAKEN_MESSAGE));
      repo.createWithUser.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.create({
          password: 'secret1',
          firstName: 'A',
          lastName: 'B',
          specialty: 'S',
          phone: '+998901112233',
        } as any),
      ).rejects.toThrow(PHONE_TAKEN_MESSAGE);
    });

    it('P2002 bo‘lmagan xato o‘zgarmasdan uzatiladi', async () => {
      repo.findById.mockResolvedValue(doc());
      const err = new Error('boom');
      repo.updateWithUser.mockRejectedValue(err);
      await expect(service.update('d1', { specialty: 'X' })).rejects.toBe(err);
    });

    it('daysOff: [] — bo‘sh massiv sifatida yoziladi (tozalash), undefined — tegilmaydi', async () => {
      repo.findById.mockResolvedValue(doc({ daysOff: ['2026-06-10'] }));
      repo.updateWithUser.mockResolvedValue(doc({ daysOff: [] }));
      const r: any = await service.update('d1', { daysOff: [] });
      expect(repo.updateWithUser.mock.calls[0][1].daysOff).toEqual([]);
      expect(r.daysOff).toEqual([]);
      await service.update('d1', { specialty: 'X' });
      expect(repo.updateWithUser.mock.calls[1][1].daysOff).toBeUndefined();
    });

    it('daysOff/schedule: null — JSON null (tozalash), 500 emas', async () => {
      repo.findById.mockResolvedValue(doc());
      await service.update('d1', { daysOff: null, schedule: null } as any);
      const data = repo.updateWithUser.mock.calls[0][1];
      expect(data.daysOff).toBe(Prisma.JsonNull);
      expect(data.schedule).toBe(Prisma.JsonNull);
    });

    it('isActive=false — doctor + login birga o‘chiriladi, sessiyalar bekor', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', { isActive: false });
      expect(repo.updateWithUser).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ isActive: false }),
        null,
        false,
      );
      expect(users.revokeSessions).toHaveBeenCalledWith('u5');
    });

    it('isActive=true — qayta yoqiladi, sessiya bekor qilinmaydi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5', isActive: false }));
      await service.update('d1', { isActive: true });
      expect(repo.updateWithUser.mock.calls[0][3]).toBe(true);
      expect(users.revokeSessions).not.toHaveBeenCalled();
    });

    it('jadval tanaffusi — faqat bittasi / teskari / ish vaqtidan tashqari → 400', async () => {
      repo.findById.mockResolvedValue(doc());
      const slot = (extra: Record<string, unknown>) => ({
        day: 0,
        startTime: '09:00',
        endTime: '18:00',
        isWorking: true,
        ...extra,
      });
      await expect(
        service.update('d1', { schedule: [slot({ breakStart: '13:00' })] }),
      ).rejects.toThrow(BREAK_PAIR_MESSAGE);
      await expect(
        service.update('d1', {
          schedule: [slot({ breakStart: '14:00', breakEnd: '13:00' })],
        }),
      ).rejects.toThrow(BREAK_PAIR_MESSAGE);
      await expect(
        service.update('d1', {
          schedule: [slot({ breakStart: '08:00', breakEnd: '09:30' })],
        }),
      ).rejects.toThrow(BREAK_OUTSIDE_MESSAGE);
      expect(repo.updateWithUser).not.toHaveBeenCalled();
      // to'g'ri tanaffus va eski (tanaffussiz) jadval o'tadi
      await service.update('d1', {
        schedule: [
          slot({ breakStart: '13:00', breakEnd: '14:00' }),
          slot({ day: 1 }),
        ],
      });
      expect(repo.updateWithUser).toHaveBeenCalledTimes(1);
    });

    it('parol + user yo‘q — yangi user yaratish ma’lumoti (fallback qiymatlar)', async () => {
      repo.findById.mockResolvedValue(doc({ avatar: 'old.png' }));
      await service.update('d1', { password: 'newpass', lastName: 'Yangi' });
      expect(users.buildCreateData).toHaveBeenCalledWith({
        name: 'Aziz Yangi',
        phone: '+998901112233',
        password: 'newpass',
        role: 'doctor',
        specialty: 'Terapevt',
        avatar: 'old.png',
      });
      expect(repo.updateWithUser.mock.calls[0][2]).toEqual({
        create: expect.objectContaining({ name: 'Aziz Yangi', role: 'doctor' }),
      });
    });

    it('parol + user yo‘q + avatar yo‘q — avatar undefined', async () => {
      repo.findById.mockResolvedValue(doc());
      await service.update('d1', { password: 'newpass' });
      expect(users.buildCreateData.mock.calls[0][0].avatar).toBeUndefined();
    });
  });

  describe('remove', () => {
    const HISTORY_MSG =
      "Shifokorni o'chirib bo'lmaydi: unga bog'langan qabullar yoki tashriflar mavjud";

    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.deleteWithUser).not.toHaveBeenCalled();
    });

    it('user bo‘lsa doctor + user bitta tranzaksiyada o‘chiriladi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await expect(service.remove('d1')).resolves.toEqual({ id: 'd1' });
      expect(repo.deleteWithUser).toHaveBeenCalledWith('d1', 'u5');
    });

    it('user yo‘q — faqat doctor', async () => {
      repo.findById.mockResolvedValue(doc());
      await service.remove('d1');
      expect(repo.deleteWithUser).toHaveBeenCalledWith('d1', null);
    });

    // Fixed: the login user used to be deleted BEFORE the doctor; with
    // bookings/visits (onDelete: Restrict) the doctor delete failed with 500
    // after the account was already gone. Now: pre-check → 409, and the
    // delete itself is atomic.
    it('remove — tarixi bor shifokor: 409, user ham o‘chirilmaydi (atomik)', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      repo.countHistory.mockResolvedValue({ bookings: 3, visits: 0 });
      await expect(service.remove('d1')).rejects.toThrow(
        new ConflictException(HISTORY_MSG),
      );
      expect(repo.deleteWithUser).not.toHaveBeenCalled();
    });

    it('remove — tekshiruvdan keyin paydo bo‘lgan bog‘liqlik (P2003) ham 409', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      repo.deleteWithUser.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: '5.22.0',
        }),
      );
      await expect(service.remove('d1')).rejects.toThrow(HISTORY_MSG);
    });

    it('remove — boshqa xatolar o‘zgarmasdan uzatiladi', async () => {
      repo.findById.mockResolvedValue(doc());
      repo.deleteWithUser.mockRejectedValue(new Error('db down'));
      await expect(service.remove('d1')).rejects.toThrow('db down');
    });
  });

  describe('getStats', () => {
    it('repo natijalarini birlashtiradi', async () => {
      repo.count.mockResolvedValue(5);
      repo.getActiveCountToday.mockResolvedValue({ count: 2 });
      repo.getTotalVisitsCount.mockResolvedValue({ count: 40 });
      await expect(service.getStats()).resolves.toEqual({
        total: 5,
        activeToday: 2,
        totalVisits: 40,
      });
      // jami son faqat faol shifokorlar
      expect(repo.count).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('getEfficiency — nofaol shifokor', () => {
    const row = (over: Record<string, unknown>) => ({
      id: 'd',
      firstName: 'A',
      lastName: 'B',
      specialty: 'S',
      phone: 'p',
      isActive: true,
      totalBookings: 0,
      completedBookings: 0,
      totalVisits: 0,
      uniquePatients: 0,
      totalRevenue: 0,
      ...over,
    });

    it('nofaol + davrda tarix yo‘q → karta chiqmaydi; tarixi bor → qoladi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        row({ id: 'a' }),
        row({ id: 'b', isActive: false }),
        row({ id: 'c', isActive: false, totalVisits: 2, totalRevenue: 5 }),
      ]);
      const out = await service.getEfficiency();
      expect(out.map((r) => r.id).sort()).toEqual(['a', 'c']);
    });
  });

  describe('getEfficiency', () => {
    const base = {
      firstName: 'A',
      lastName: 'B',
      specialty: 'S',
      phone: 'p',
      isActive: true,
      uniquePatients: 0,
    };

    it('conversion, avgCheck hisoblanadi va revenue bo‘yicha saralanadi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 3,
          completedBookings: 2,
          totalVisits: 2,
          totalRevenue: 300_000,
        },
        {
          ...base,
          id: 'd2',
          totalBookings: 10,
          completedBookings: 5,
          totalVisits: 5,
          totalRevenue: 1_000_000,
        },
      ]);
      const out = await service.getEfficiency();
      expect(out.map((x) => x.id)).toEqual(['d2', 'd1']);
      expect(out[0]).toMatchObject({ conversionRate: 50, avgCheck: 200_000 });
      // 2/3 = 66.67% → 67; 300000/2 = 150000
      expect(out[1]).toMatchObject({ conversionRate: 67, avgCheck: 150_000 });
    });

    it('conversionRate tashriflarga emas, completed qabullarga bog‘liq', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 4,
          completedBookings: 1,
          totalVisits: 4,
          totalRevenue: 400,
        },
      ]);
      const [s] = await service.getEfficiency();
      expect(s.conversionRate).toBe(25);
    });

    it('nolga bo‘lish yo‘q — 0 qaytaradi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 0,
          completedBookings: 0,
          totalVisits: 0,
          totalRevenue: 0,
        },
      ]);
      const [s] = await service.getEfficiency();
      expect(s.conversionRate).toBe(0);
      expect(s.avgCheck).toBe(0);
    });

    it('conversionRate — completed / bekor qilinmagan qabullar, 100 dan oshmaydi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 2,
          completedBookings: 3,
          totalVisits: 5,
          totalRevenue: 500,
        },
      ]);
      const [s] = await service.getEfficiency();
      expect(s.conversionRate).toBe(100);
    });

    it('avgCheck yaxlitlanadi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 3,
          completedBookings: 3,
          totalVisits: 3,
          totalRevenue: 100,
        },
      ]);
      const [s] = await service.getEfficiency();
      expect(s.avgCheck).toBe(33);
      expect(s.conversionRate).toBe(100);
    });
  });
});
