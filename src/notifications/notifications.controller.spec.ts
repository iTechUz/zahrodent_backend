import 'reflect-metadata';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: Record<
    'findAll' | 'create' | 'sendReminders' | 'findRecipients' | 'bulkSend',
    jest.Mock
  >;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      sendReminders: jest.fn(),
      findRecipients: jest.fn(),
      bulkSend: jest.fn(),
    };
    controller = new NotificationsController(
      service as unknown as NotificationsService,
    );
  });

  it('findAll — query va foydalanuvchi uzatiladi', async () => {
    const query = { page: 1 } as any;
    const user = { id: 'u1', role: 'doctor' } as any;
    service.findAll.mockResolvedValue({ data: [], total: 0 });
    await expect(controller.findAll(query, user)).resolves.toEqual({
      data: [],
      total: 0,
    });
    expect(service.findAll).toHaveBeenCalledWith(query, user);
  });

  it('create — dto uzatiladi', async () => {
    const dto = { message: 'Salom' } as any;
    service.create.mockResolvedValue({ id: 'n1' });
    await expect(controller.create(dto)).resolves.toEqual({ id: 'n1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('sendReminders — argumentsiz chaqiriladi, hisob qaytadi', async () => {
    const res = { created: 1, smsSent: 1 };
    service.sendReminders.mockResolvedValue(res);
    await expect(controller.sendReminders()).resolves.toBe(res);
    expect(service.sendReminders).toHaveBeenCalledWith();
  });

  it('findRecipients — query uzatiladi', async () => {
    const query = { search: 'ali' } as any;
    service.findRecipients.mockResolvedValue([]);
    await expect(controller.findRecipients(query)).resolves.toEqual([]);
    expect(service.findRecipients).toHaveBeenCalledWith(query);
  });

  it('bulkSend — dto uzatiladi', async () => {
    const dto = { patientIds: ['p1'], message: 'x' } as any;
    service.bulkSend.mockResolvedValue({ sent: 1 });
    await expect(controller.bulkSend(dto)).resolves.toEqual({ sent: 1 });
    expect(service.bulkSend).toHaveBeenCalledWith(dto);
  });

  it('xatolar tarqaladi', async () => {
    service.bulkSend.mockRejectedValue(new Error('fail'));
    await expect(controller.bulkSend({} as any)).rejects.toThrow('fail');
    service.sendReminders.mockRejectedValue(new Error('eskiz'));
    await expect(controller.sendReminders()).rejects.toThrow('eskiz');
  });

  describe('metadata', () => {
    it('guardlar va klass rollari', () => {
      expect(
        Reflect.getMetadata('__guards__', NotificationsController),
      ).toEqual([JwtAuthGuard, RolesGuard]);
      expect(Reflect.getMetadata(ROLES_KEY, NotificationsController)).toEqual([
        'admin',
        'receptionist',
      ]);
    });

    it('findAll — doctor ham ko‘ra oladi', () => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          NotificationsController.prototype.findAll,
        ),
      ).toEqual(['admin', 'receptionist', 'doctor']);
    });

    it.each(['create', 'sendReminders', 'findRecipients', 'bulkSend'] as const)(
      '%s — klass rollari (doctor yo‘q)',
      (m) => {
        expect(
          Reflect.getMetadata(ROLES_KEY, NotificationsController.prototype[m]),
        ).toBeUndefined();
      },
    );
  });
});
