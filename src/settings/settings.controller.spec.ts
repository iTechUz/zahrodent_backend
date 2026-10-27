import 'reflect-metadata';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: Record<'get' | 'update', jest.Mock>;

  beforeEach(() => {
    service = { get: jest.fn(), update: jest.fn() };
    controller = new SettingsController(service as unknown as SettingsService);
  });

  it('get — servis natijasini qaytaradi', async () => {
    service.get.mockResolvedValue({ reminderDaysAhead: 1 });
    await expect(controller.get()).resolves.toEqual({ reminderDaysAhead: 1 });
    expect(service.get).toHaveBeenCalledWith();
  });

  it('update — dto uzatiladi', async () => {
    const dto = { reminderDaysAhead: 2 } as any;
    service.update.mockResolvedValue({ reminderDaysAhead: 2 });
    await expect(controller.update(dto)).resolves.toEqual({
      reminderDaysAhead: 2,
    });
    expect(service.update).toHaveBeenCalledWith(dto);
  });

  it('xatolar tarqaladi', async () => {
    service.update.mockRejectedValue(new Error('bad'));
    await expect(controller.update({} as any)).rejects.toThrow('bad');
    service.get.mockRejectedValue(new Error('db'));
    await expect(controller.get()).rejects.toThrow('db');
  });

  it('metadata: guardlar, klass — xodimlar, update — faqat admin', () => {
    expect(Reflect.getMetadata('__guards__', SettingsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
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
