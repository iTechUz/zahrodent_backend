import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('PatientsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: PatientsController;
  const user = { id: 'u1', role: 'admin' } as any;

  beforeEach(() => {
    service = {
      getStats: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
      addComment: jest.fn(),
      findComments: jest.fn(),
    };
    controller = new PatientsController(service as unknown as PatientsService);
  });

  it('getStats — user', async () => {
    service.getStats.mockResolvedValue({ total: 1 });
    await expect(controller.getStats(user)).resolves.toEqual({ total: 1 });
    expect(service.getStats).toHaveBeenCalledWith(user);
  });

  it('findAll — query va user', async () => {
    const query = { search: 'a' } as any;
    service.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query, user)).resolves.toEqual({
      data: [],
    });
    expect(service.findAll).toHaveBeenCalledWith(query, user);
  });

  it('findOne — includeDeleted faqat aynan "true" bo‘lsa true', async () => {
    service.findOne.mockResolvedValue({ id: 'p1' });
    await controller.findOne('p1', { includeDeleted: 'true' } as any, user);
    expect(service.findOne).toHaveBeenLastCalledWith('p1', user, {
      includeDeleted: true,
    });
    await controller.findOne('p1', { includeDeleted: 'false' } as any, user);
    expect(service.findOne).toHaveBeenLastCalledWith('p1', user, {
      includeDeleted: false,
    });
    await controller.findOne('p1', {} as any, user);
    expect(service.findOne).toHaveBeenLastCalledWith('p1', user, {
      includeDeleted: false,
    });
    await controller.findOne('p1', { includeDeleted: 'TRUE' } as any, user);
    expect(service.findOne).toHaveBeenLastCalledWith('p1', user, {
      includeDeleted: false,
    });
  });

  it('create — dto', async () => {
    const dto = { firstName: 'A' } as any;
    service.create.mockResolvedValue({ id: 'p1' });
    await expect(controller.create(dto)).resolves.toEqual({ id: 'p1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('update — id, dto, user', async () => {
    const dto = { age: 5 } as any;
    service.update.mockResolvedValue({ id: 'p1' });
    await controller.update('p1', dto, user);
    expect(service.update).toHaveBeenCalledWith('p1', dto, user);
  });

  it('remove — id va user', async () => {
    service.remove.mockResolvedValue({ id: 'p1' });
    await expect(controller.remove('p1', user)).resolves.toEqual({ id: 'p1' });
    expect(service.remove).toHaveBeenCalledWith('p1', user);
  });

  it('restore — faqat id', async () => {
    service.restore.mockResolvedValue({ id: 'p1' });
    await expect(controller.restore('p1')).resolves.toEqual({ id: 'p1' });
    expect(service.restore).toHaveBeenCalledWith('p1');
  });

  it('addComment — patientId URL dan olinadi va dto ni ustiga yozadi', async () => {
    const dto = { text: 'izoh', patientId: 'boshqa' } as any;
    service.addComment.mockResolvedValue({ id: 'c1' });
    await expect(controller.addComment('p1', dto, user)).resolves.toEqual({
      id: 'c1',
    });
    expect(service.addComment).toHaveBeenCalledWith(
      { text: 'izoh', patientId: 'p1' },
      user,
    );
    expect(dto.patientId).toBe('boshqa');
  });

  it('findComments — id va user', async () => {
    service.findComments.mockResolvedValue([]);
    await expect(controller.findComments('p1', user)).resolves.toEqual([]);
    expect(service.findComments).toHaveBeenCalledWith('p1', user);
  });

  it('servis xatosi tarqaladi', async () => {
    const err = new Error('nf');
    service.restore.mockRejectedValue(err);
    await expect(controller.restore('x')).rejects.toBe(err);
    service.addComment.mockRejectedValue(err);
    await expect(controller.addComment('x', {} as any, user)).rejects.toBe(err);
  });

  describe('metadata', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    const p = PatientsController.prototype;

    it('guardlar va klass roli', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, PatientsController)).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
      expect(roles(PatientsController)).toEqual([
        'admin',
        'doctor',
        'receptionist',
      ]);
    });

    it('create — admin/receptionist; remove va restore — faqat admin', () => {
      expect(roles(p.create)).toEqual(['admin', 'receptionist']);
      expect(roles(p.remove)).toEqual(['admin']);
      expect(roles(p.restore)).toEqual(['admin']);
    });

    it('restore HTTP 200 qaytaradi (POST default 201 emas)', () => {
      expect(Reflect.getMetadata('__httpCode__', p.restore)).toBe(200);
      expect(Reflect.getMetadata('__httpCode__', p.create)).toBeUndefined();
    });
  });
});
