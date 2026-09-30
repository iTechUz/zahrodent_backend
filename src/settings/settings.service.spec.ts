import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SettingsService } from './settings.service';
import { PrismaService } from '../database/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsController } from './settings.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { DEFAULT_REMINDER_TEMPLATE } from './reminder-template';

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  clinicName: 'Zahro Dental',
  address: '',
  phone: '',
  workingHours: '',
  smsReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
  telegramReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
  reminderDaysAhead: 1,
  updatedAt: new Date(),
  ...over,
});

describe('SettingsService', () => {
  let prisma: { clinicSettings: { findUnique: jest.Mock; upsert: jest.Mock } };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      clinicSettings: {
        findUnique: jest.fn().mockResolvedValue(row()),
        upsert: jest.fn().mockResolvedValue(row()),
      },
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  it('get — kontrakt shakli (id/updatedAt yo‘q)', async () => {
    await expect(service.get()).resolves.toEqual({
      clinicName: 'Zahro Dental',
      address: '',
      phone: '',
      workingHours: '',
      smsReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
      telegramReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
      reminderDaysAhead: 1,
    });
    expect(prisma.clinicSettings.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(prisma.clinicSettings.upsert).not.toHaveBeenCalled();
  });

  it('get — qator yo‘q bo‘lsa standart qiymatlar bilan yaratiladi', async () => {
    prisma.clinicSettings.findUnique.mockResolvedValue(null);
    await expect(service.get()).resolves.toMatchObject({
      clinicName: 'Zahro Dental',
    });
    expect(prisma.clinicSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: {
        id: 1,
        smsReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
        telegramReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
      },
      update: {},
    });
  });

  it('update — qisman, faqat yuborilgan maydonlar', async () => {
    prisma.clinicSettings.upsert.mockResolvedValue(
      row({ reminderDaysAhead: 3 }),
    );
    await expect(
      service.update({ reminderDaysAhead: 3 }),
    ).resolves.toMatchObject({ reminderDaysAhead: 3 });
    expect(prisma.clinicSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        update: { reminderDaysAhead: 3 },
      }),
    );
  });
});

describe('UpdateSettingsDto', () => {
  const errors = async (plain: object) =>
    (await validate(plainToInstance(UpdateSettingsDto, plain))).map(
      (e) => e.property,
    );

  it('bo‘sh body — yaroqli', async () => {
    await expect(errors({})).resolves.toEqual([]);
  });

  it('shablon ≤ 500, reminderDaysAhead 0..7 butun son', async () => {
    await expect(
      errors({
        smsReminderTemplate: 'x'.repeat(500),
        telegramReminderTemplate: 'y',
        reminderDaysAhead: 0,
      }),
    ).resolves.toEqual([]);
    await expect(
      errors({ smsReminderTemplate: 'x'.repeat(501) }),
    ).resolves.toEqual(['smsReminderTemplate']);
    await expect(errors({ telegramReminderTemplate: '' })).resolves.toEqual([
      'telegramReminderTemplate',
    ]);
    await expect(errors({ reminderDaysAhead: 8 })).resolves.toEqual([
      'reminderDaysAhead',
    ]);
    await expect(errors({ reminderDaysAhead: -1 })).resolves.toEqual([
      'reminderDaysAhead',
    ]);
    await expect(errors({ reminderDaysAhead: 1.5 })).resolves.toEqual([
      'reminderDaysAhead',
    ]);
  });

  it('clinicName bo‘sh bo‘lolmaydi, matn maydonlari cheklangan', async () => {
    await expect(errors({ clinicName: '' })).resolves.toEqual(['clinicName']);
    await expect(errors({ address: 'a'.repeat(301) })).resolves.toEqual([
      'address',
    ]);
    await expect(errors({ phone: 5 })).resolves.toEqual(['phone']);
  });
});

describe('SettingsController rollari', () => {
  it('GET — barcha xodimlar, PATCH — faqat admin', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SettingsController)).toEqual([
      'admin',
      'doctor',
      'receptionist',
    ]);
    expect(
      Reflect.getMetadata(ROLES_KEY, SettingsController.prototype.update),
    ).toEqual(['admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, SettingsController.prototype.get),
    ).toBeUndefined();
  });
});
