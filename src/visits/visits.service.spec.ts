import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { VisitsRepository } from './visits.repository';
import type { AuthUserView } from '../auth/auth.service';

describe('VisitsService', () => {
  let service: VisitsService;
  let repo: jest.Mocked<
    Pick<VisitsRepository, 'findAll' | 'findById' | 'create' | 'update'>
  >;

  const admin: AuthUserView = {
    id: 'u1',
    name: 'Admin',
    phone: '+998901234567',
    role: 'admin',
  };
  const doctor: AuthUserView = {
    id: 'u2',
    name: 'Dr',
    phone: '+998901234568',
    role: 'doctor',
    doctorId: 'd1',
  };

  const visit = (partial: Record<string, unknown> = {}) =>
    ({
      id: 'v1',
      patientId: 'p1',
      doctorId: 'd1',
      bookingId: null,
      date: new Date('2026-06-10T00:00:00.000Z'),
      status: 'completed',
      price: 200_000,
      diagnosis: 'Karies',
      treatment: 'Plomba',
      notes: '',
      ...partial,
    }) as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(visit()),
      update: jest.fn().mockResolvedValue(visit()),
    };
    service = new VisitsService(repo as unknown as VisitsRepository);
  });

  afterEach(() => jest.useRealTimers());

  describe('findAll', () => {
    const where = () => repo.findAll.mock.calls[0][0];

    it('default pagination', async () => {
      await service.findAll({}, admin);
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
    });

    it('admin — patientId va doctorId filtrlari', async () => {
      await service.findAll(
        { patientId: 'p1', doctorId: 'd9', page: 1, limit: 20 },
        admin,
      );
      expect(repo.findAll).toHaveBeenCalledWith(
        { patientId: 'p1', doctorId: 'd9' },
        { skip: 20, take: 20 },
      );
    });

    it('doctor — query dagi doctorId e’tiborsiz, o‘zi majburiy', async () => {
      await service.findAll({ doctorId: 'd9' }, doctor);
      expect(where()).toEqual({ doctorId: 'd1' });
    });

    it('search — diagnoz/davolash bo‘yicha (trim)', async () => {
      await service.findAll({ search: ' karies ' }, admin);
      expect(where()).toEqual({
        OR: [
          { diagnosis: { contains: 'karies', mode: 'insensitive' } },
          { treatment: { contains: 'karies', mode: 'insensitive' } },
        ],
      });
    });

    it('response — bookingId null → undefined, price null → 0', async () => {
      repo.findAll.mockResolvedValue({
        data: [visit({ price: null }), visit({ id: 'v2', bookingId: 'b1' })],
        total: 2,
      });
      const out = await service.findAll({}, admin);
      expect(out.data[0]).toEqual({
        id: 'v1',
        patientId: 'p1',
        doctorId: 'd1',
        bookingId: undefined,
        date: '2026-06-10',
        status: 'completed',
        diagnosis: 'Karies',
        treatment: 'Plomba',
        notes: '',
        price: 0,
      });
      expect(out.data[1].bookingId).toBe('b1');
      expect(out.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x', admin)).rejects.toThrow(
        new NotFoundException('Tashrif topilmadi'),
      );
    });

    it('doctor — begona tashrif 404 (access restricted)', async () => {
      repo.findById.mockResolvedValue(visit({ doctorId: 'other' }));
      await expect(service.findOne('v1', doctor)).rejects.toThrow(
        new NotFoundException('Tashrif topilmadi'),
      );
    });

    it('doctor — o‘z tashrifi', async () => {
      repo.findById.mockResolvedValue(visit());
      await expect(service.findOne('v1', doctor)).resolves.toMatchObject({
        id: 'v1',
      });
    });
  });

  describe('create', () => {
    afterEach(() => jest.useRealTimers());

    it('minimal dto — defaultlar va bugungi sana (Asia/Tashkent)', async () => {
      // 2026-06-17 20:00Z = 2026-06-18 01:00 Toshkent
      jest.useFakeTimers({ now: new Date('2026-06-17T20:00:00.000Z') });
      await service.create(
        {
          patientId: 'p1',
          doctorId: 'd1',
          status: 'not-started',
        },
        admin,
      );
      expect(repo.create).toHaveBeenCalledWith({
        patient: { connect: { id: 'p1', deletedAt: null } },
        doctor: { connect: { id: 'd1' } },
        booking: undefined,
        date: new Date('2026-06-18T00:00:00.000Z'),
        status: 'not-started',
        diagnosis: '',
        treatment: '',
        notes: '',
        price: 0,
      });
    });

    it('to‘liq dto — booking connect va berilgan sana', async () => {
      await service.create(
        {
          patientId: 'p1',
          doctorId: 'd1',
          bookingId: 'b1',
          date: '2026-06-10',
          status: 'completed',
          diagnosis: 'D',
          treatment: 'T',
          notes: 'N',
          price: 150_000,
        },
        admin,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking: { connect: { id: 'b1' } },
          date: new Date('2026-06-10T00:00:00.000Z'),
          diagnosis: 'D',
          treatment: 'T',
          notes: 'N',
          price: 150_000,
        }),
      );
    });

    // Fixed: create() ignored the caller, so a doctor could create a visit
    // attributed to any doctorId. Now doctorId is forced to the doctor's own.
    it('doctor — boshqa shifokor nomidan tashrif yarata olmaydi (o‘z doctorId majburiy)', async () => {
      await service.create(
        { patientId: 'p1', doctorId: 'd2', status: 'completed' },
        doctor,
      );
      expect(repo.create.mock.calls[0][0].doctor).toEqual({
        connect: { id: 'd1' },
      });
    });

    it('admin — istalgan shifokor nomidan yaratadi', async () => {
      await service.create(
        { patientId: 'p1', doctorId: 'd2', status: 'completed' },
        admin,
      );
      expect(repo.create.mock.calls[0][0].doctor).toEqual({
        connect: { id: 'd2' },
      });
    });

    it('doctor profili yo‘q — 403, yaratilmaydi', async () => {
      await expect(
        service.create(
          { patientId: 'p1', doctorId: 'd2', status: 'completed' },
          { ...doctor, doctorId: undefined },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', {}, admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('doctor — begona tashrifni o‘zgartira olmaydi', async () => {
      repo.findById.mockResolvedValue(visit({ doctorId: 'other' }));
      await expect(
        service.update('v1', { notes: 'x' }, doctor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('qisman update — relationlar undefined', async () => {
      repo.findById.mockResolvedValue(visit());
      await service.update('v1', { price: 300_000 }, admin);
      expect(repo.update).toHaveBeenCalledWith('v1', {
        date: undefined,
        status: undefined,
        diagnosis: undefined,
        treatment: undefined,
        notes: undefined,
        price: 300_000,
        patient: undefined,
        doctor: undefined,
        booking: undefined,
      });
    });

    it('relation va sana o‘zgarishlari', async () => {
      repo.findById.mockResolvedValue(visit());
      await service.update(
        'v1',
        {
          patientId: 'p2',
          doctorId: 'd2',
          bookingId: 'b2',
          date: '2026-07-01',
        },
        admin,
      );
      expect(repo.update.mock.calls[0][1]).toMatchObject({
        date: new Date('2026-07-01T00:00:00.000Z'),
        patient: { connect: { id: 'p2' } },
        doctor: { connect: { id: 'd2' } },
        booking: { connect: { id: 'b2' } },
      });
    });

    it('doctor — tashrifni boshqa shifokorga o‘tkaza olmaydi (doctorId e’tiborsiz)', async () => {
      repo.findById.mockResolvedValue(visit());
      await service.update('v1', { doctorId: 'd2', notes: 'x' }, doctor);
      expect(repo.update.mock.calls[0][1].doctor).toBeUndefined();
      expect(repo.update.mock.calls[0][1].notes).toBe('x');
    });

    it('bookingId "" — disconnect', async () => {
      repo.findById.mockResolvedValue(visit({ bookingId: 'b1' }));
      await service.update('v1', { bookingId: '' }, admin);
      expect(repo.update.mock.calls[0][1].booking).toEqual({
        disconnect: true,
      });
    });
  });
});
