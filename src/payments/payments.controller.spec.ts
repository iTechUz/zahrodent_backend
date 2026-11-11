import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('PaymentsController', () => {
  const user = { id: 'u1', name: 'Admin', role: 'admin' } as any;
  let service: Record<string, jest.Mock>;
  let controller: PaymentsController;

  beforeEach(() => {
    service = {
      getStats: jest.fn(),
      getDoctorStats: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getAudit: jest.fn(),
    };
    controller = new PaymentsController(service as unknown as PaymentsService);
  });

  it('getStats va getDoctorStats — argumentsiz', async () => {
    service.getStats.mockResolvedValue({ totalRevenue: 1 });
    service.getDoctorStats.mockResolvedValue([]);
    await expect(controller.getStats()).resolves.toEqual({ totalRevenue: 1 });
    await expect(controller.getDoctorStats({})).resolves.toEqual([]);
    expect(service.getStats).toHaveBeenCalledWith();
    expect(service.getDoctorStats).toHaveBeenCalledWith({});
  });

  it('findAll — query', async () => {
    const query = { page: 1 } as any;
    service.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query)).resolves.toEqual({ data: [] });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne — id', async () => {
    service.findOne.mockResolvedValue({ id: 'pay1' });
    await expect(controller.findOne('pay1')).resolves.toEqual({ id: 'pay1' });
    expect(service.findOne).toHaveBeenCalledWith('pay1');
  });

  it('create — dto', async () => {
    const dto = { amount: 1000 } as any;
    service.create.mockResolvedValue({ id: 'pay1' });
    await expect(controller.create(dto, user)).resolves.toEqual({ id: 'pay1' });
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('update — id va dto', async () => {
    const dto = { amount: 2000 } as any;
    service.update.mockResolvedValue({ id: 'pay1' });
    await controller.update('pay1', dto, user);
    expect(service.update).toHaveBeenCalledWith('pay1', dto, user);
  });

  it('audit — id', async () => {
    service.getAudit.mockResolvedValue([]);
    await expect(controller.audit('pay1')).resolves.toEqual([]);
    expect(service.getAudit).toHaveBeenCalledWith('pay1');
  });

  it('remove — id', async () => {
    service.remove.mockResolvedValue({ id: 'pay1' });
    await expect(controller.remove('pay1', user)).resolves.toEqual({
      id: 'pay1',
    });
    expect(service.remove).toHaveBeenCalledWith('pay1', user);
  });

  it('servis xatosi tarqaladi', async () => {
    const err = new Error('bad');
    service.create.mockRejectedValue(err);
    await expect(controller.create({} as any, user)).rejects.toBe(err);
    service.getStats.mockRejectedValue(err);
    await expect(controller.getStats()).rejects.toBe(err);
  });

  it('metadata — butun controller faqat admin (moliya)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PaymentsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, PaymentsController)).toEqual([
      'admin',
    ]);
    const p = PaymentsController.prototype;
    for (const fn of [
      p.getStats,
      p.getDoctorStats,
      p.findAll,
      p.findOne,
      p.create,
      p.update,
      p.remove,
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, fn)).toBeUndefined();
    }
  });
});
