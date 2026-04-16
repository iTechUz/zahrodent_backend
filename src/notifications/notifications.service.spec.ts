import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { EskizService } from './eskiz.service';
import { PrismaService } from '../database/prisma.service';

describe('NotificationsService.sendReminders', () => {
  let service: NotificationsService;
  let notificationsRepo: jest.Mocked<
    Pick<NotificationsRepository, 'createMany'>
  >;
  let bookingsRepo: jest.Mocked<
    Pick<BookingsRepository, 'findAll' | 'markReminderSent'>
  >;
  let patientsRepo: jest.Mocked<
    Pick<
      PatientsRepository,
      'findSourcesByPatientIds' | 'findPhonesByPatientIds'
    >
  >;
  let eskiz: jest.Mocked<
    Pick<EskizService, 'isConfigured' | 'normalizeMobile' | 'sendSms'>
  >;
  let prisma: PrismaService;

  beforeEach(() => {
    notificationsRepo = { createMany: jest.fn().mockResolvedValue(undefined) };
    bookingsRepo = {
      findAll: jest.fn(),
      markReminderSent: jest.fn().mockResolvedValue(undefined),
    };
    patientsRepo = {
      findSourcesByPatientIds: jest.fn(),
      findPhonesByPatientIds: jest.fn().mockResolvedValue([]),
    };
    eskiz = {
      isConfigured: jest.fn().mockReturnValue(false),
      normalizeMobile: jest.fn(),
      sendSms: jest.fn(),
    };
    prisma = {
      booking: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      patient: {
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;
    service = new NotificationsService(
      notificationsRepo as unknown as NotificationsRepository,
      bookingsRepo as unknown as BookingsRepository,
      patientsRepo as unknown as PatientsRepository,
      eskiz as unknown as EskizService,
      prisma,
    );
  });

  it('booking bo‘lmasa created: 0', async () => {
    bookingsRepo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    const out = await service.sendReminders();
    expect(out).toEqual(expect.objectContaining({ created: 0 }));
    expect(notificationsRepo.createMany).not.toHaveBeenCalled();
    expect(bookingsRepo.markReminderSent).not.toHaveBeenCalled();
  });

  it('bir marta patients batch, createMany bitta chaqiruv', async () => {
    const d = new Date('2026-06-01');
    bookingsRepo.findAll.mockResolvedValue({
      data: [
        {
          id: 'b1',
          patientId: 'p1',
          doctorId: 'd1',
          date: d,
          time: '10:00',
          source: 'phone',
          status: 'pending',
          notes: '',
          createdAt: d,
          serviceId: null,
          reminderSentAt: null,
        },
      ],
      total: 1,
    } as any);
    patientsRepo.findSourcesByPatientIds.mockResolvedValue([
      { id: 'p1', source: 'telegram' },
    ]);
    patientsRepo.findPhonesByPatientIds.mockResolvedValue([
      { id: 'p1', phone: '+998901112233' },
    ]);

    const out = await service.sendReminders();
    expect(out.created).toBe(1);
    expect(patientsRepo.findSourcesByPatientIds).toHaveBeenCalledTimes(1);
    expect(patientsRepo.findPhonesByPatientIds).toHaveBeenCalledWith(['p1']);
    expect(patientsRepo.findSourcesByPatientIds).toHaveBeenCalledWith(['p1']);
    expect(notificationsRepo.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          patientId: 'p1',
          type: 'telegram',
          status: 'sent',
        }),
      ]),
    );
    expect(bookingsRepo.markReminderSent).toHaveBeenCalledTimes(1);
    expect(bookingsRepo.markReminderSent).toHaveBeenCalledWith(
      ['b1'],
      expect.any(Date),
    );
  });
});
