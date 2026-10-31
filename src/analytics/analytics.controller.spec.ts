import 'reflect-metadata';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: Record<'getDashboard' | 'getMonthly' | 'getSources', jest.Mock>;
  const user = { id: 'u1', role: 'admin' } as any;

  beforeEach(() => {
    service = {
      getDashboard: jest.fn(),
      getMonthly: jest.fn(),
      getSources: jest.fn(),
    };
    controller = new AnalyticsController(
      service as unknown as AnalyticsService,
    );
  });

  describe('getDashboard', () => {
    it('user va query.date uzatiladi', async () => {
      service.getDashboard.mockResolvedValue({ patients: 1 });
      await expect(
        controller.getDashboard({ date: '2026-09-01' } as any, user),
      ).resolves.toEqual({ patients: 1 });
      expect(service.getDashboard).toHaveBeenCalledWith(user, '2026-09-01');
    });

    it('date berilmasa — undefined', async () => {
      await controller.getDashboard({} as any, user);
      expect(service.getDashboard).toHaveBeenCalledWith(user, undefined);
    });
  });

  describe('getMonthly', () => {
    it('months uzatiladi', async () => {
      service.getMonthly.mockResolvedValue([]);
      await expect(
        controller.getMonthly({ months: 12 } as any, user),
      ).resolves.toEqual([]);
      expect(service.getMonthly).toHaveBeenCalledWith(user, 12);
    });

    it('months berilmasa — standart 6', async () => {
      await controller.getMonthly({} as any, user);
      expect(service.getMonthly).toHaveBeenCalledWith(user, 6);
    });
  });

  describe('getSources', () => {
    it('type=patients uzatiladi', async () => {
      service.getSources.mockResolvedValue([{ source: 'x', count: 1 }]);
      await expect(
        controller.getSources({ type: 'patients' } as any, user),
      ).resolves.toEqual([{ source: 'x', count: 1 }]);
      expect(service.getSources).toHaveBeenCalledWith(user, 'patients');
    });

    it('type berilmasa — standart bookings', async () => {
      await controller.getSources({} as any, user);
      expect(service.getSources).toHaveBeenCalledWith(user, 'bookings');
    });
  });

  it('xatolar tarqaladi', async () => {
    service.getDashboard.mockRejectedValue(new Error('403'));
    await expect(controller.getDashboard({} as any, user)).rejects.toThrow(
      '403',
    );
    service.getMonthly.mockRejectedValue(new Error('x'));
    await expect(controller.getMonthly({} as any, user)).rejects.toThrow('x');
    service.getSources.mockRejectedValue(new Error('y'));
    await expect(controller.getSources({} as any, user)).rejects.toThrow('y');
  });

  it('metadata: guardlar va klass rollari', () => {
    expect(Reflect.getMetadata('__guards__', AnalyticsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AnalyticsController)).toEqual([
      'admin',
      'doctor',
      'receptionist',
    ]);
    for (const m of ['getDashboard', 'getMonthly', 'getSources'] as const) {
      expect(
        Reflect.getMetadata(ROLES_KEY, AnalyticsController.prototype[m]),
      ).toBeUndefined();
    }
  });
});
