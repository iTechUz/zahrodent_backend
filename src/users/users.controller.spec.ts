import 'reflect-metadata';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('UsersController', () => {
  let controller: UsersController;
  let service: Record<
    'findAll' | 'findOne' | 'create' | 'update' | 'remove',
    jest.Mock
  >;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('findAll — query uzatiladi', async () => {
    const query = { search: 'ali' } as any;
    service.findAll.mockResolvedValue({ data: [], total: 0 });
    await expect(controller.findAll(query)).resolves.toEqual({
      data: [],
      total: 0,
    });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne — id uzatiladi', async () => {
    service.findOne.mockResolvedValue({ id: 'u1' });
    await expect(controller.findOne('u1')).resolves.toEqual({ id: 'u1' });
    expect(service.findOne).toHaveBeenCalledWith('u1');
  });

  it('create — dto uzatiladi', async () => {
    const dto = { phone: '+998901234567' } as any;
    service.create.mockResolvedValue({ id: 'u1' });
    await expect(controller.create(dto)).resolves.toEqual({ id: 'u1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('update — id va dto uzatiladi', async () => {
    const dto = { firstName: 'Ali' } as any;
    service.update.mockResolvedValue({ id: 'u1' });
    await controller.update('u1', dto);
    expect(service.update).toHaveBeenCalledWith('u1', dto);
  });

  it('remove — id va joriy foydalanuvchi id si uzatiladi', async () => {
    service.remove.mockResolvedValue({ success: true });
    await expect(
      controller.remove('u2', { id: 'admin1' } as any),
    ).resolves.toEqual({ success: true });
    expect(service.remove).toHaveBeenCalledWith('u2', 'admin1');
  });

  it('xatolar tarqaladi (masalan 409)', async () => {
    service.remove.mockRejectedValue(new Error('conflict'));
    await expect(controller.remove('u1', { id: 'u1' } as any)).rejects.toThrow(
      'conflict',
    );
    service.findAll.mockRejectedValue(new Error('db'));
    await expect(controller.findAll({} as any)).rejects.toThrow('db');
  });

  it('metadata: guardlar va faqat admin', () => {
    expect(Reflect.getMetadata('__guards__', UsersController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual(['admin']);
    for (const m of [
      'findAll',
      'findOne',
      'create',
      'update',
      'remove',
    ] as const) {
      expect(
        Reflect.getMetadata(ROLES_KEY, UsersController.prototype[m]),
      ).toBeUndefined();
    }
  });
});
