import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUserView } from '../auth/auth.service';
import {
  generatePrescriptionCode,
  PRESCRIPTION_EXPIRED,
  PRESCRIPTION_NOT_ACTIVE,
  PRESCRIPTION_NOT_FOUND,
  PATIENT_NOT_AVAILABLE,
  PrescriptionsService,
} from './prescriptions.service';
import { PrescriptionsRepository } from './prescriptions.repository';

describe('generatePrescriptionCode', () => {
  it('8 belgi, noaniq belgilarsiz (0/O/1/I/L)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePrescriptionCode()).toMatch(
        /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/,
      );
    }
  });
});

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let repo: jest.Mocked<
    Pick<
      PrescriptionsRepository,
      | 'findAll'
      | 'findById'
      | 'create'
      | 'transition'
      | 'countPatients'
      | 'countVisits'
    >
  >;

  const admin: AuthUserView = {
    id: 'u1',
    name: 'Admin',
    phone: '+998900000000',
    role: 'admin',
  };
  const doctor: AuthUserView = {
    id: 'u2',
    name: 'Doc',
    phone: '+998900000001',
    role: 'doctor',
    doctorId: 'd1',
  };

  const row = (partial: Record<string, unknown> = {}) =>
    ({
      id: 'p1',
      code: 'ABCD2345',
      patientId: 'pt1',
      doctorId: 'd1',
      visitId: null,
      status: 'issued',
      notes: '',
      validUntil: new Date('2999-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      dispensedAt: null,
      patient: { firstName: 'Ali', lastName: 'Vali', age: 30 },
      doctor: { firstName: 'Doc', lastName: 'Tor', specialty: 'Terapevt' },
      items: [
        {
          id: 'i1',
          name: 'Paratsetamol',
          dosage: '500mg',
          frequency: '2x',
          duration: '3 kun',
          quantity: '10',
          instructions: '',
        },
      ],
      ...partial,
    }) as any;

  const clash = () =>
    new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
    });

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(row()),
      transition: jest.fn(),
      countPatients: jest.fn().mockResolvedValue(1),
      countVisits: jest.fn().mockResolvedValue(1),
    };
    service = new PrescriptionsService(
      repo as unknown as PrescriptionsRepository,
    );
  });

  describe('create', () => {
    const dto = {
      patientId: 'pt1',
      doctorId: 'd9',
      items: [{ name: '  Aspirin  ' }],
    } as any;

    it('admin uchun doctorId majburiy', async () => {
      await expect(
        service.create({ ...dto, doctorId: undefined }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('bemor topilmasa 404', async () => {
      repo.countPatients.mockResolvedValue(0);
      await expect(service.create(dto, admin)).rejects.toThrow(
        PATIENT_NOT_AVAILABLE,
      );
    });

    it('shifokor doctorId ni dto dan emas, o‘z profilidan oladi va faqat o‘z bemorlariga yozadi', async () => {
      await service.create(dto, doctor);
      const where = repo.countPatients.mock.calls[0][0] as any;
      expect(where.OR).toBeDefined();
      expect(repo.create.mock.calls[0][0].doctor).toEqual({
        connect: { id: 'd1' },
      });
    });

    it('admin uchun bemor filtri OR siz', async () => {
      await service.create(dto, admin);
      const where = repo.countPatients.mock.calls[0][0] as any;
      expect(where).toEqual({ id: 'pt1', deletedAt: null });
    });

    it('doctor akkaunti doctorId siz bo‘lsa 403', async () => {
      await expect(
        service.create(dto, { ...doctor, doctorId: undefined }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('visitId noto‘g‘ri bo‘lsa 400', async () => {
      repo.countVisits.mockResolvedValue(0);
      await expect(
        service.create({ ...dto, visitId: 'v1' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.countVisits).toHaveBeenCalledWith({
        id: 'v1',
        patientId: 'pt1',
        doctorId: 'd9',
      });
    });

    it('dori nomi trim, bo‘sh maydonlar ""; default 30 kun muddat', async () => {
      await service.create(dto, admin);
      const data = repo.create.mock.calls[0][0] as any;
      expect(data.items.create[0]).toEqual({
        name: 'Aspirin',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: '',
        instructions: '',
      });
      expect(data.notes).toBe('');
      expect(data.visit).toBeUndefined();
      expect(data.code).toMatch(/^[A-Z2-9]{8}$/);
      const days =
        (data.validUntil.getTime() - Date.now()) / (24 * 3600 * 1000);
      expect(days).toBeGreaterThan(28);
      expect(days).toBeLessThan(31);
    });

    it('validDays hisobga olinadi', async () => {
      await service.create({ ...dto, validDays: 7 }, admin);
      const days =
        ((repo.create.mock.calls[0][0] as any).validUntil.getTime() -
          Date.now()) /
        (24 * 3600 * 1000);
      expect(days).toBeGreaterThan(5);
      expect(days).toBeLessThan(8);
    });

    it('kod to‘qnashsa (P2002) qayta urinadi', async () => {
      repo.create.mockRejectedValueOnce(clash()).mockResolvedValueOnce(row());
      const res = await service.create(dto, admin);
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(res.code).toBe('ABCD2345');
    });

    it('5 marta to‘qnashsa 409', async () => {
      repo.create.mockRejectedValue(clash());
      await expect(service.create(dto, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.create).toHaveBeenCalledTimes(5);
    });

    it('boshqa xatoni qayta urinmasdan tashlaydi', async () => {
      repo.create.mockRejectedValue(new Error('db down'));
      await expect(service.create(dto, admin)).rejects.toThrow('db down');
      expect(repo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('default pagination va filtrsiz where', async () => {
      await service.findAll({} as any, admin);
      expect(repo.findAll.mock.calls[0][0]).toEqual({});
      expect(repo.findAll.mock.calls[0][1]).toMatchObject({
        skip: 0,
        take: 10,
      });
    });

    it('status "all" e’tiborsiz, patientId va sahifa ishlaydi', async () => {
      await service.findAll(
        { status: 'all', patientId: 'pt1', page: 2, limit: 5 } as any,
        admin,
      );
      expect(repo.findAll.mock.calls[0][0]).toEqual({ patientId: 'pt1' });
      expect(repo.findAll.mock.calls[0][1]).toMatchObject({
        skip: 10,
        take: 5,
      });
    });

    it('shifokor faqat o‘z retseptlarini ko‘radi', async () => {
      await service.findAll({ status: 'issued' } as any, doctor);
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        status: 'issued',
        doctorId: 'd1',
      });
    });

    it('javobni formatlaydi', async () => {
      repo.findAll.mockResolvedValue({ data: [row()], total: 1 });
      const res = await service.findAll({} as any, admin);
      expect(res.total).toBe(1);
      expect(res.data[0]).toMatchObject({
        id: 'p1',
        validUntil: '2999-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
        dispensedAt: null,
        visitId: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x', admin)).rejects.toThrow(
        PRESCRIPTION_NOT_FOUND,
      );
    });

    it('shifokor birovning retseptini 404 deb oladi', async () => {
      repo.findById.mockResolvedValue(row({ doctorId: 'other' }));
      await expect(service.findOne('p1', doctor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('o‘z retseptini ko‘radi', async () => {
      repo.findById.mockResolvedValue(row());
      const res = await service.findOne('p1', doctor);
      expect(res.items).toHaveLength(1);
      expect(res.patient).toEqual({
        firstName: 'Ali',
        lastName: 'Vali',
        age: 30,
      });
    });
  });

  describe('cancel', () => {
    it('faol retseptni bekor qiladi', async () => {
      repo.findById.mockResolvedValue(row({ status: 'cancelled' }));
      repo.transition.mockResolvedValue(1);
      const res = await service.cancel('p1', admin);
      expect(repo.transition).toHaveBeenCalledWith('p1', 'issued', {
        status: 'cancelled',
      });
      expect(res.status).toBe('cancelled');
    });

    it('faol bo‘lmasa 409', async () => {
      repo.findById.mockResolvedValue(row({ status: 'dispensed' }));
      repo.transition.mockResolvedValue(0);
      await expect(service.cancel('p1', admin)).rejects.toThrow(
        PRESCRIPTION_NOT_ACTIVE,
      );
    });

    it('shifokor birovning retseptini bekor qila olmaydi', async () => {
      repo.findById.mockResolvedValue(row({ doctorId: 'other' }));
      await expect(service.cancel('p1', doctor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.transition).not.toHaveBeenCalled();
    });
  });

  describe('dispense', () => {
    it('topilmasa 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.dispense('x', admin)).rejects.toThrow(
        PRESCRIPTION_NOT_FOUND,
      );
    });

    it('muddati o‘tgan bo‘lsa 409', async () => {
      repo.findById.mockResolvedValue(
        row({ validUntil: new Date('2000-01-01T00:00:00Z') }),
      );
      await expect(service.dispense('p1', admin)).rejects.toThrow(
        PRESCRIPTION_EXPIRED,
      );
      expect(repo.transition).not.toHaveBeenCalled();
    });

    it('allaqachon berilgan bo‘lsa 409 (race himoyasi)', async () => {
      repo.findById.mockResolvedValue(row());
      repo.transition.mockResolvedValue(0);
      await expect(service.dispense('p1', admin)).rejects.toThrow(
        PRESCRIPTION_NOT_ACTIVE,
      );
    });

    it('beradi: status, dispensedBy va muddat sharti bilan', async () => {
      repo.findById.mockResolvedValue(row({ status: 'dispensed' }));
      repo.transition.mockResolvedValue(1);
      const res = await service.dispense('p1', admin);
      const [id, from, data, minValid] = repo.transition.mock.calls[0] as any;
      expect(id).toBe('p1');
      expect(from).toBe('issued');
      expect(data).toMatchObject({ status: 'dispensed', dispensedBy: 'u1' });
      expect(data.dispensedAt).toBeInstanceOf(Date);
      expect(minValid).toBeInstanceOf(Date);
      expect(res.status).toBe('dispensed');
    });
  });

  describe('pharmacySearch', () => {
    const whereOf = () => repo.findAll.mock.calls[0][0] as any;

    it('kod bo‘yicha: tirelar olib tashlanib, katta harfga o‘tadi', async () => {
      await service.pharmacySearch(' abcd-2345 ');
      expect(whereOf().code).toBe('ABCD2345');
      expect(whereOf().status).toBe('issued');
    });

    it('telefon bo‘yicha: bir nechta format', async () => {
      await service.pharmacySearch('+998 90 123 45 67');
      expect(whereOf().patient.phone.in).toEqual([
        '+998 90 123 45 67',
        '998901234567',
        '+998901234567',
      ]);
      expect(whereOf().code).toBeUndefined();
    });

    it('raqamli 12 xonali satr kod emas, telefon deb olinadi', async () => {
      await service.pharmacySearch('998901234567');
      expect(whereOf().code).toBeUndefined();
      expect(whereOf().patient.phone).toBeDefined();
    });

    it('juda qisqa so‘rov hech narsa topmaydi', async () => {
      await service.pharmacySearch('ab');
      expect(whereOf().id).toBe('');
    });

    it('natijani formatlaydi va 20 ta bilan cheklaydi', async () => {
      repo.findAll.mockResolvedValue({ data: [row()], total: 1 });
      const res = await service.pharmacySearch('ABCD2345');
      expect(repo.findAll.mock.calls[0][1]).toEqual({ take: 20 });
      expect(res[0].code).toBe('ABCD2345');
    });
  });
});
