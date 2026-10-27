import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('DoctorsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: DoctorsController;

  beforeEach(() => {
    service = {
      getStats: jest.fn(),
      getEfficiency: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new DoctorsController(service as unknown as DoctorsService);
  });

  it('getStats va getEfficiency — argumentsiz delegatsiya', async () => {
    service.getStats.mockResolvedValue({ a: 1 });
    service.getEfficiency.mockResolvedValue([{ b: 2 }]);
    await expect(controller.getStats()).resolves.toEqual({ a: 1 });
    await expect(controller.getEfficiency()).resolves.toEqual([{ b: 2 }]);
    expect(service.getStats).toHaveBeenCalledWith();
    expect(service.getEfficiency).toHaveBeenCalledWith();
  });

  it('findAll — query', async () => {
    const query = { search: 'ali' } as any;
    service.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query)).resolves.toEqual({ data: [] });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne — id', async () => {
    service.findOne.mockResolvedValue({ id: 'd1' });
    await expect(controller.findOne('d1')).resolves.toEqual({ id: 'd1' });
    expect(service.findOne).toHaveBeenCalledWith('d1');
  });

  it('create — dto', async () => {
    const dto = { name: 'Dr' } as any;
    service.create.mockResolvedValue({ id: 'd1' });
    await expect(controller.create(dto)).resolves.toEqual({ id: 'd1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('update — id va dto', async () => {
    const dto = { name: 'New' } as any;
    service.update.mockResolvedValue({ id: 'd1' });
    await controller.update('d1', dto);
    expect(service.update).toHaveBeenCalledWith('d1', dto);
  });

  it('remove — id', async () => {
    service.remove.mockResolvedValue({ id: 'd1' });
    await expect(controller.remove('d1')).resolves.toEqual({ id: 'd1' });
    expect(service.remove).toHaveBeenCalledWith('d1');
  });

  it('servis xatosi (masalan 409) tarqaladi', async () => {
    const err = new Error('conflict');
    service.remove.mockRejectedValue(err);
    await expect(controller.remove('d1')).rejects.toBe(err);
    service.update.mockRejectedValue(err);
    await expect(controller.update('d1', {} as any)).rejects.toBe(err);
  });

  describe('metadata', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    const p = DoctorsController.prototype;

    it('guardlar va klass roli', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, DoctorsController)).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
      expect(roles(DoctorsController)).toEqual(['admin', 'receptionist']);
    });

    it('doctor roli faqat findAll/findOne ni o‘qiy oladi', () => {
      expect(roles(p.findAll)).toEqual(['admin', 'receptionist', 'doctor']);
      expect(roles(p.findOne)).toEqual(['admin', 'receptionist', 'doctor']);
    });

    it('stats, efficiency va yozish amallari faqat admin', () => {
      for (const fn of [
        p.getStats,
        p.getEfficiency,
        p.create,
        p.update,
        p.remove,
      ]) {
        expect(roles(fn)).toEqual(['admin']);
      }
    });
  });
});
