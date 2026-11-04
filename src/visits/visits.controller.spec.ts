import { GUARDS_METADATA } from '@nestjs/common/constants';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('VisitsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: VisitsController;
  const user = { id: 'u1', role: 'doctor' } as any;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    controller = new VisitsController(service as unknown as VisitsService);
  });

  it('findAll — query va user', async () => {
    const query = { page: 1 } as any;
    service.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query, user)).resolves.toEqual({
      data: [],
    });
    expect(service.findAll).toHaveBeenCalledWith(query, user);
  });

  it('findOne — id va user', async () => {
    service.findOne.mockResolvedValue({ id: 'v1' });
    await expect(controller.findOne('v1', user)).resolves.toEqual({
      id: 'v1',
    });
    expect(service.findOne).toHaveBeenCalledWith('v1', user);
  });

  it('create — dto va user (doctorId scope servisda)', async () => {
    const dto = { patientId: 'p1' } as any;
    service.create.mockResolvedValue({ id: 'v1' });
    await expect(controller.create(dto, user)).resolves.toEqual({ id: 'v1' });
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('update — id, dto, user', async () => {
    const dto = { notes: 'x' } as any;
    service.update.mockResolvedValue({ id: 'v1' });
    await controller.update('v1', dto, user);
    expect(service.update).toHaveBeenCalledWith('v1', dto, user);
  });

  it('servis xatosi tarqaladi', async () => {
    const err = new Error('forbidden');
    service.update.mockRejectedValue(err);
    await expect(controller.update('v1', {} as any, user)).rejects.toBe(err);
    service.findAll.mockRejectedValue(err);
    await expect(controller.findAll({} as any, user)).rejects.toBe(err);
  });

  describe('metadata', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    const p = VisitsController.prototype;

    it('guardlar va klass roli', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, VisitsController)).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
      expect(roles(VisitsController)).toEqual([
        'admin',
        'doctor',
        'receptionist',
      ]);
    });

    it('create/update — admin va doctor (receptionist yo‘q)', () => {
      expect(roles(p.create)).toEqual(['admin', 'doctor']);
      expect(roles(p.update)).toEqual(['admin', 'doctor']);
      expect(roles(p.findAll)).toBeUndefined();
      expect(roles(p.findOne)).toBeUndefined();
    });
  });
});
