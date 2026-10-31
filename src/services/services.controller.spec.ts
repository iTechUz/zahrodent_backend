import 'reflect-metadata';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('ServicesController', () => {
  let controller: ServicesController;
  let service: Record<
    'getStats' | 'findAll' | 'findOne' | 'create' | 'update' | 'remove',
    jest.Mock
  >;

  beforeEach(() => {
    service = {
      getStats: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new ServicesController(service as unknown as ServicesService);
  });

  describe('delegatsiya', () => {
    it('getStats — servisga uzatadi va natijani qaytaradi', () => {
      service.getStats.mockReturnValue({ total: 3 });
      expect(controller.getStats()).toEqual({ total: 3 });
      expect(service.getStats).toHaveBeenCalledWith();
    });

    it('findAll — query uzatiladi', async () => {
      const query = { search: 'plomba', page: 1 } as any;
      service.findAll.mockResolvedValue({ data: [], total: 0 });
      await expect(controller.findAll(query)).resolves.toEqual({
        data: [],
        total: 0,
      });
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('findOne — id uzatiladi', async () => {
      service.findOne.mockResolvedValue({ id: 's1' });
      await expect(controller.findOne('s1')).resolves.toEqual({ id: 's1' });
      expect(service.findOne).toHaveBeenCalledWith('s1');
    });

    it('create — dto uzatiladi', async () => {
      const dto = { name: 'Plomba', price: 1 } as any;
      service.create.mockResolvedValue({ id: 's1' });
      await expect(controller.create(dto)).resolves.toEqual({ id: 's1' });
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('update — id va dto uzatiladi', async () => {
      const dto = { price: 5 } as any;
      service.update.mockResolvedValue({ id: 's1', price: 5 });
      await expect(controller.update('s1', dto)).resolves.toEqual({
        id: 's1',
        price: 5,
      });
      expect(service.update).toHaveBeenCalledWith('s1', dto);
    });

    it('remove — id uzatiladi', async () => {
      service.remove.mockResolvedValue({ success: true });
      await expect(controller.remove('s1')).resolves.toEqual({
        success: true,
      });
      expect(service.remove).toHaveBeenCalledWith('s1');
    });

    it('xatolar tarqaladi', async () => {
      service.findOne.mockRejectedValue(new Error('boom'));
      await expect(controller.findOne('x')).rejects.toThrow('boom');
      service.create.mockRejectedValue(new Error('dup'));
      await expect(controller.create({} as any)).rejects.toThrow('dup');
    });
  });

  describe('metadata', () => {
    const roles = (method?: keyof ServicesController) =>
      Reflect.getMetadata(
        ROLES_KEY,
        method ? ServicesController.prototype[method] : ServicesController,
      );

    it('guardlar: JwtAuthGuard + RolesGuard', () => {
      expect(Reflect.getMetadata('__guards__', ServicesController)).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
    });

    it('klass darajasida barcha xodimlar', () => {
      expect(roles()).toEqual(['admin', 'doctor', 'receptionist']);
    });

    it('stats — admin va receptionist', () => {
      expect(roles('getStats')).toEqual(['admin', 'receptionist']);
    });

    it.each(['create', 'update', 'remove'] as const)(
      '%s — faqat admin',
      (m) => {
        expect(roles(m)).toEqual(['admin']);
      },
    );

    it.each(['findAll', 'findOne'] as const)(
      '%s — klass rollari (override yo‘q)',
      (m) => {
        expect(roles(m)).toBeUndefined();
      },
    );
  });
});
