import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('BookingsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: BookingsController;
  const user = { id: 'u1', role: 'receptionist' } as any;

  beforeEach(() => {
    service = {
      getStats: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new BookingsController(service as unknown as BookingsService);
  });

  it('getStats — user bilan servisga uzatadi', async () => {
    service.getStats.mockResolvedValue({ total: 3 });
    await expect(controller.getStats(user)).resolves.toEqual({ total: 3 });
    expect(service.getStats).toHaveBeenCalledWith(user);
  });

  it('findAll — query va user', async () => {
    const query = { page: 2 } as any;
    service.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query, user)).resolves.toEqual({
      data: [],
    });
    expect(service.findAll).toHaveBeenCalledWith(query, user);
  });

  it('findOne — id va user', async () => {
    service.findOne.mockResolvedValue({ id: 'b1' });
    await expect(controller.findOne('b1', user)).resolves.toEqual({
      id: 'b1',
    });
    expect(service.findOne).toHaveBeenCalledWith('b1', user);
  });

  it('create — faqat dto (user uzatilmaydi)', async () => {
    const dto = { patientId: 'p1' } as any;
    service.create.mockResolvedValue({ id: 'b1' });
    await expect(controller.create(dto)).resolves.toEqual({ id: 'b1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('update — id, dto, user', async () => {
    const dto = { status: 'confirmed' } as any;
    service.update.mockResolvedValue({ id: 'b1' });
    await controller.update('b1', dto, user);
    expect(service.update).toHaveBeenCalledWith('b1', dto, user);
  });

  it('remove — id va user', async () => {
    service.remove.mockResolvedValue({ id: 'b1' });
    await expect(controller.remove('b1', user)).resolves.toEqual({ id: 'b1' });
    expect(service.remove).toHaveBeenCalledWith('b1', user);
  });

  it('servis xatosi o‘zgarishsiz tarqaladi', async () => {
    const err = new Error('boom');
    service.findOne.mockRejectedValue(err);
    await expect(controller.findOne('x', user)).rejects.toBe(err);
    service.create.mockRejectedValue(err);
    await expect(controller.create({} as any)).rejects.toBe(err);
  });

  describe('metadata', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);

    it('guardlar va klass roli', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, BookingsController)).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
      expect(roles(BookingsController)).toEqual([
        'admin',
        'doctor',
        'receptionist',
      ]);
    });

    it('yozish amallari faqat admin/receptionist', () => {
      const p = BookingsController.prototype;
      for (const fn of [p.create, p.update, p.remove]) {
        expect(roles(fn)).toEqual(['admin', 'receptionist']);
      }
    });

    it('o‘qish amallari klass rolini meros qiladi', () => {
      const p = BookingsController.prototype;
      for (const fn of [p.getStats, p.findAll, p.findOne]) {
        expect(roles(fn)).toBeUndefined();
      }
    });
  });
});
