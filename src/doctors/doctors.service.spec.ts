import { NotFoundException } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsRepository } from './doctors.repository';
import { UsersService } from '../users/users.service';

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
    >
  >;
  let users: jest.Mocked<Pick<UsersService, 'create' | 'update' | 'remove'>>;

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
    };
    users = {
      create: jest.fn().mockResolvedValue({ id: 'u1' } as any),
      update: jest.fn(),
      remove: jest.fn(),
    };
    service = new DoctorsService(
      repo as unknown as DoctorsRepository,
      users as unknown as UsersService,
    );
  });

  describe('findAll', () => {
    it('default pagination', async () => {
      await service.findAll({});
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
    });

    it('specialty "all" e’tiborsiz, boshqasi filtr', async () => {
      await service.findAll({ specialty: 'all', page: 1, limit: 5 });
      expect(repo.findAll).toHaveBeenLastCalledWith({}, { skip: 5, take: 5 });
      await service.findAll({ specialty: 'Ortoped' });
      expect(repo.findAll.mock.calls[1][0]).toEqual({ specialty: 'Ortoped' });
    });

    it('search — ism/familiya', async () => {
      await service.findAll({ search: 'az' });
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        OR: [
          { firstName: { contains: 'az', mode: 'insensitive' } },
          { lastName: { contains: 'az', mode: 'insensitive' } },
        ],
      });
    });

    it('bo‘sh search e’tiborsiz', async () => {
      await service.findAll({ search: '  ' });
      expect(repo.findAll.mock.calls[0][0]).toEqual({});
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

  describe('findOne', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(
        new NotFoundException('Doctor not found'),
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
      expect(users.create).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        avatar: undefined,
        user: undefined,
        schedule: undefined,
        daysOff: undefined,
      });
    });

    it('parol bilan — doctor rolida user yaratib connect qiladi', async () => {
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
      expect(users.create).toHaveBeenCalledWith({
        name: 'Aziz Karimov',
        phone: '+998901112233',
        password: 'secret1',
        role: 'doctor',
        specialty: 'Terapevt',
        avatar: 'a.png',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { connect: { id: 'u1' } },
          schedule,
          daysOff: ['2026-06-01'],
        }),
      );
    });

    it('user yaratish xatosi (masalan 409) — doctor yaratilmaydi', async () => {
      users.create.mockRejectedValue(new Error('conflict'));
      await expect(
        service.create({ ...dto, password: 'secret1' }),
      ).rejects.toThrow('conflict');
      expect(repo.create).not.toHaveBeenCalled();
    });

    // BUG (doctors.service.ts:56-77): user and doctor are created in two
    // separate writes without a transaction; if doctorsRepository.create
    // fails, the freshly created login user is left orphaned (and the phone
    // is then "taken" for the retry → 409).
    it.todo(
      'create — doctor yaratish yiqilsa user ham qaytarilishi (rollback) kerak',
    );
  });

  describe('update', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('parolsiz — user tegilmaydi, userId saqlanadi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', { specialty: 'Ortoped' });
      expect(users.update).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({
          specialty: 'Ortoped',
          user: { connect: { id: 'u5' } },
        }),
      );
    });

    it('parolsiz va user yo‘q — user undefined', async () => {
      repo.findById.mockResolvedValue(doc());
      await service.update('d1', { firstName: 'B' });
      expect(repo.update.mock.calls[0][1].user).toBeUndefined();
    });

    it('parol + mavjud user — yangi ism bilan update', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', {
        password: 'newpass',
        firstName: 'Bek',
        lastName: 'Aliyev',
        phone: '+998909999999',
      });
      expect(users.update).toHaveBeenCalledWith('u5', {
        name: 'Bek Aliyev',
        phone: '+998909999999',
        password: 'newpass',
        specialty: undefined,
        avatar: undefined,
      });
    });

    it('parol + mavjud user — ism/telefon berilmasa eski qiymatlar', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await service.update('d1', { password: 'newpass', firstName: 'Only' });
      expect(users.update).toHaveBeenCalledWith(
        'u5',
        expect.objectContaining({
          name: 'Aziz Karimov',
          phone: '+998901112233',
        }),
      );
    });

    it('parol + user yo‘q — yangi user yaratib bog‘laydi (fallback qiymatlar)', async () => {
      repo.findById.mockResolvedValue(doc({ avatar: 'old.png' }));
      users.create.mockResolvedValue({ id: 'u7' } as any);
      await service.update('d1', { password: 'newpass', lastName: 'Yangi' });
      expect(users.create).toHaveBeenCalledWith({
        name: 'Aziz Yangi',
        phone: '+998901112233',
        password: 'newpass',
        role: 'doctor',
        specialty: 'Terapevt',
        avatar: 'old.png',
      });
      expect(repo.update.mock.calls[0][1].user).toEqual({
        connect: { id: 'u7' },
      });
    });

    it('parol + user yo‘q + avatar yo‘q — avatar undefined', async () => {
      repo.findById.mockResolvedValue(doc());
      await service.update('d1', { password: 'newpass' });
      expect(users.create.mock.calls[0][0].avatar).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('user bo‘lsa uni ham o‘chiradi', async () => {
      repo.findById.mockResolvedValue(doc({ userId: 'u5' }));
      await expect(service.remove('d1')).resolves.toEqual({ id: 'd1' });
      expect(users.remove).toHaveBeenCalledWith('u5');
      expect(repo.delete).toHaveBeenCalledWith('d1');
    });

    it('user yo‘q — faqat doctor', async () => {
      repo.findById.mockResolvedValue(doc());
      await service.remove('d1');
      expect(users.remove).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith('d1');
    });

    // BUG (doctors.service.ts:134-138): the login user is deleted BEFORE the
    // doctor. Booking/Visit → Doctor relations are onDelete: Restrict, so for
    // any doctor with history the doctor delete fails (500) after the user
    // account is already gone — the doctor remains but can no longer log in.
    // Needs a transaction (or delete doctor first / pre-check relations).
    it.todo('remove — doctor o‘chmasa user ham o‘chirilmasligi kerak (atomik)');
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
    });
  });

  describe('getEfficiency', () => {
    const base = {
      firstName: 'A',
      lastName: 'B',
      specialty: 'S',
      phone: 'p',
      uniquePatients: 0,
    };

    it('conversion, avgCheck hisoblanadi va revenue bo‘yicha saralanadi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 3,
          totalVisits: 2,
          totalRevenue: 300_000,
        },
        {
          ...base,
          id: 'd2',
          totalBookings: 10,
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

    it('nolga bo‘lish yo‘q — 0 qaytaradi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 0,
          totalVisits: 0,
          totalRevenue: 0,
        },
      ]);
      const [s] = await service.getEfficiency();
      expect(s.conversionRate).toBe(0);
      expect(s.avgCheck).toBe(0);
    });

    it('avgCheck yaxlitlanadi', async () => {
      repo.getDetailedEfficiencyStats.mockResolvedValue([
        {
          ...base,
          id: 'd1',
          totalBookings: 3,
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
