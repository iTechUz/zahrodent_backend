import { BadRequestException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import type { AuthUserView } from '../auth/auth.service';

describe('PatientsService — telefon, tug‘ilgan yil, balans maydonlari', () => {
  let service: PatientsService;
  let repo: any;
  const admin: AuthUserView = {
    id: 'u1',
    name: 'A',
    phone: '+998901234567',
    role: 'admin',
  };
  const doctor: AuthUserView = {
    ...admin,
    id: 'u2',
    role: 'doctor',
    doctorId: 'd1',
  };
  const base = {
    firstName: 'Ali',
    lastName: 'Valiyev',
    phone: '+998901112233',
    workplace: '',
  };
  const row = (extra: Record<string, unknown> = {}) => ({
    id: 'p1',
    firstName: 'Ali',
    lastName: 'Valiyev',
    age: 30,
    birthYear: null,
    phone: '+998901112233',
    source: 'walk-in',
    notes: '',
    address: '',
    workplace: '',
    avatar: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    toothChart: null,
    assignedDoctorId: null,
    assignedDoctor: null,
    deletedAt: null,
    payments: [],
    visits: [],
    ...extra,
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-08T08:00:00.000Z') });
    repo = {
      findById: jest.fn().mockResolvedValue(row()),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(row()),
      update: jest.fn().mockResolvedValue(row()),
      findActiveIdsByMobile: jest.fn().mockResolvedValue([]),
    };
    service = new PatientsService(repo as PatientsRepository);
  });
  afterEach(() => jest.useRealTimers());

  describe('create', () => {
    it('telefon +998XXXXXXXXX ga keltiriladi', async () => {
      await service.create({ ...base, phone: '90 111-22-33', age: 30 });
      expect(repo.create.mock.calls[0][0].phone).toBe('+998901112233');
    });

    it('o‘zbek bo‘lmagan raqam o‘zgarishsiz (trim)', async () => {
      await service.create({ ...base, phone: ' +7 495 123 45 67 ', age: 30 });
      expect(repo.create.mock.calls[0][0].phone).toBe('+7 495 123 45 67');
      expect(repo.findActiveIdsByMobile).not.toHaveBeenCalled();
    });

    it('birthYear → age hisoblanadi va ikkalasi saqlanadi', async () => {
      await service.create({ ...base, birthYear: 2000 });
      expect(repo.create.mock.calls[0][0]).toMatchObject({
        birthYear: 2000,
        age: 26,
      });
    });

    it('faqat age → birthYear chiqariladi', async () => {
      await service.create({ ...base, age: 8 });
      expect(repo.create.mock.calls[0][0]).toMatchObject({
        birthYear: 2018,
        age: 8,
      });
    });

    it('age ham birthYear ham yo‘q — 400, yozilmaydi', async () => {
      await expect(service.create({ ...base })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('bo‘sh workplace ruxsat etiladi', async () => {
      await service.create({ ...base, age: 30, workplace: undefined });
      expect(repo.create.mock.calls[0][0].workplace).toBe('');
    });

    it('takroriy telefon — bloklanmaydi, javobda duplicatePhone', async () => {
      repo.findActiveIdsByMobile.mockResolvedValue([{ id: 'p9' }]);
      const res: any = await service.create({ ...base, age: 30 });
      expect(repo.create).toHaveBeenCalled();
      expect(res.duplicatePhone).toEqual({ count: 1, patientIds: ['p9'] });
    });

    it('takroriy telefon yo‘q — duplicatePhone maydoni yo‘q', async () => {
      const res: any = await service.create({ ...base, age: 30 });
      expect(res.duplicatePhone).toBeUndefined();
    });
  });

  describe('update', () => {
    it('telefon normallanadi; o‘zi dublikat hisoblanmaydi', async () => {
      repo.findActiveIdsByMobile.mockResolvedValue([{ id: 'p1' }]);
      const res: any = await service.update(
        'p1',
        { phone: '901112233' },
        admin,
      );
      expect(repo.update.mock.calls[0][1].phone).toBe('+998901112233');
      expect(res.duplicatePhone).toBeUndefined();
    });

    it('telefon berilmasa tegilmaydi va dublikat tekshirilmaydi', async () => {
      await service.update('p1', { notes: 'x' }, admin);
      expect(repo.update.mock.calls[0][1].phone).toBeUndefined();
      expect(repo.findActiveIdsByMobile).not.toHaveBeenCalled();
    });

    it('birthYear yangilanganda age qayta hisoblanadi', async () => {
      await service.update('p1', { birthYear: 1990 }, admin);
      expect(repo.update.mock.calls[0][1]).toMatchObject({
        birthYear: 1990,
        age: 36,
      });
    });

    it('age/birthYear berilmasa tegilmaydi', async () => {
      await service.update('p1', { notes: 'x' }, admin);
      expect(repo.update.mock.calls[0][1].age).toBeUndefined();
      expect(repo.update.mock.calls[0][1].birthYear).toBeUndefined();
    });

    it('doctor — boshqa bemorlar id si ko‘rsatilmaydi', async () => {
      repo.findActiveIdsByMobile.mockResolvedValue([{ id: 'p9' }]);
      const res: any = await service.update(
        'p1',
        { phone: '901112233' },
        doctor,
      );
      expect(res.duplicatePhone).toBeUndefined();
    });
  });

  describe('toResponse', () => {
    it('birthYear bor — age hisoblanadi; birthYear qaytariladi', () => {
      const r = service.toResponse(row({ birthYear: 1990, age: 5 }) as any);
      expect(r.age).toBe(36);
      expect(r.birthYear).toBe(1990);
    });

    it('birthYear yo‘q — age ustuni, birthYear null', () => {
      const r = service.toResponse(row() as any);
      expect(r.age).toBe(30);
      expect(r.birthYear).toBeNull();
    });

    it('balance, totalPaid (faqat INCOME), totalRefunded, totalOwed izchil', () => {
      const r = service.toResponse(
        row({
          payments: [
            { amount: 500, status: 'paid', discount: null, type: 'INCOME' },
            { amount: 100, status: 'paid', discount: null, type: 'EXPENSE' },
          ],
          visits: [{ price: 300 }],
        }) as any,
      );
      expect(r).toMatchObject({
        totalPaid: 500,
        totalRefunded: 100,
        totalOwed: 300,
        balance: 200,
      });
    });
  });
});
