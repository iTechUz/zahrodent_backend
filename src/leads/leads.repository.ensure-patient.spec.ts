import { LeadsRepository } from './leads.repository';
import { PrismaService } from '../database/prisma.service';

describe('LeadsRepository.updateAndEnsurePatient', () => {
  let tx: any;
  let prisma: any;
  let repo: LeadsRepository;
  const date = new Date('2026-01-02T00:00:00Z');
  const data = { status: 'converted' } as any;
  const baseLead = {
    name: 'Ali Valiyev',
    phone: '+998901234567',
    source: 'website',
    service: null,
    message: null,
  };

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      lead: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1' }),
      },
      patient: { findFirst: jest.fn(), create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    repo = new LeadsRepository(prisma as PrismaService);
  });

  it('mavjud (o‘chirilmagan) bemor bo‘lsa — yangi yaratilmaydi', async () => {
    tx.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const res = await repo.updateAndEnsurePatient('l1', data, baseLead, date);
    expect(res).toEqual({ id: 'l1' });
    expect(tx.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'l1', status: { not: 'converted' } },
      data,
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.patient.findFirst).toHaveBeenCalledWith({
      where: { phone: { in: [baseLead.phone] }, deletedAt: null },
      select: { id: true },
    });
    expect(tx.patient.create).not.toHaveBeenCalled();
  });

  it('bemor yo‘q — ism/familiya ajratiladi, izoh va sana bilan yaratiladi', async () => {
    tx.patient.findFirst.mockResolvedValue(null);
    await repo.updateAndEnsurePatient(
      'l1',
      data,
      {
        ...baseLead,
        name: '  Ali  Karim  Valiyev ',
        service: 'Tish',
        message: 'Og‘riq',
      },
      date,
    );
    expect(tx.patient.create).toHaveBeenCalledWith({
      data: {
        firstName: 'Ali',
        lastName: 'Karim Valiyev',
        age: 0,
        birthYear: null,
        workplace: '',
        phone: baseLead.phone,
        source: 'website',
        notes: 'Xizmat: Tish\nMurojaat: Og‘riq',
        createdAt: date,
      },
    });
  });

  it('bitta so‘zli ism — lastName bo‘sh, izoh bo‘sh qator', async () => {
    tx.patient.findFirst.mockResolvedValue(null);
    await repo.updateAndEnsurePatient(
      'l1',
      data,
      { ...baseLead, name: 'Ali', message: 'Salom' },
      date,
    );
    const arg = tx.patient.create.mock.calls[0][0].data;
    expect(arg.firstName).toBe('Ali');
    expect(arg.lastName).toBe('');
    expect(arg.notes).toBe('Murojaat: Salom');
  });

  it('faqat bo‘shliqdan iborat ism — firstName lead.name ga qaytadi', async () => {
    tx.patient.findFirst.mockResolvedValue(null);
    await repo.updateAndEnsurePatient(
      'l1',
      data,
      { ...baseLead, name: '   ' },
      date,
    );
    const arg = tx.patient.create.mock.calls[0][0].data;
    expect(arg.firstName).toBe('   ');
    expect(arg.lastName).toBe('');
    expect(arg.notes).toBe('');
  });

  it.each([
    ['telegram_bot', 'telegram'],
    ['website', 'website'],
    ['phone', 'phone'],
    ['instagram', 'phone'],
  ])('source %s -> patient.source %s', async (src, expected) => {
    tx.patient.findFirst.mockResolvedValue(null);
    await repo.updateAndEnsurePatient(
      'l1',
      data,
      { ...baseLead, source: src },
      date,
    );
    expect(tx.patient.create.mock.calls[0][0].data.source).toBe(expected);
  });

  it('parallel so‘rov holatni allaqachon o‘zgartirgan — bemor yaratilmaydi (idempotent)', async () => {
    tx.lead.updateMany.mockResolvedValue({ count: 0 });
    tx.lead.findUniqueOrThrow.mockResolvedValue({
      id: 'l1',
      status: 'converted',
    });
    const res = await repo.updateAndEnsurePatient('l1', data, baseLead, date);
    expect(res).toEqual({ id: 'l1', status: 'converted' });
    expect(tx.patient.findFirst).not.toHaveBeenCalled();
    expect(tx.patient.create).not.toHaveBeenCalled();
  });

  it('o‘zbek raqami — bemor kanonik +998 formatida yaratiladi va ikkala format qidiriladi', async () => {
    tx.patient.findFirst.mockResolvedValue(null);
    await repo.updateAndEnsurePatient(
      'l1',
      data,
      { ...baseLead, phone: '90 123 45 67' },
      date,
    );
    expect(tx.patient.findFirst).toHaveBeenCalledWith({
      where: {
        phone: { in: ['90 123 45 67', '+998901234567'] },
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(tx.patient.create.mock.calls[0][0].data.phone).toBe('+998901234567');
  });

  it('bemor yaratish xatosi tranzaksiyadan tashqariga chiqadi', async () => {
    tx.patient.findFirst.mockResolvedValue(null);
    const err = new Error('unique');
    tx.patient.create.mockRejectedValue(err);
    await expect(
      repo.updateAndEnsurePatient('l1', data, baseLead, date),
    ).rejects.toBe(err);
  });
});
