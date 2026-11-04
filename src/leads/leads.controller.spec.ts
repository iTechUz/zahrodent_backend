import { GUARDS_METADATA } from '@nestjs/common/constants';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('LeadsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: LeadsController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new LeadsController(service as unknown as LeadsService);
  });

  it('findAll — query', async () => {
    const query = { status: 'new' } as any;
    service.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query)).resolves.toEqual({ data: [] });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne — id', async () => {
    service.findOne.mockResolvedValue({ id: 'l1' });
    await expect(controller.findOne('l1')).resolves.toEqual({ id: 'l1' });
    expect(service.findOne).toHaveBeenCalledWith('l1');
  });

  it('create — dto', async () => {
    const dto = { name: 'Ali', phone: '+998901234567' } as any;
    service.create.mockResolvedValue({ id: 'l1' });
    await expect(controller.create(dto)).resolves.toEqual({ id: 'l1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('update — id va dto', async () => {
    const dto = { name: 'Vali' } as any;
    service.update.mockResolvedValue({ id: 'l1' });
    await expect(controller.update('l1', dto)).resolves.toEqual({ id: 'l1' });
    expect(service.update).toHaveBeenCalledWith('l1', dto);
  });

  it('updateStatus — service.update ga delegatsiya qiladi', async () => {
    const dto = { status: 'converted' } as any;
    service.update.mockResolvedValue({ id: 'l1', status: 'converted' });
    await expect(controller.updateStatus('l1', dto)).resolves.toEqual({
      id: 'l1',
      status: 'converted',
    });
    expect(service.update).toHaveBeenCalledWith('l1', dto);
  });

  it('remove — id', async () => {
    service.remove.mockResolvedValue({ id: 'l1' });
    await expect(controller.remove('l1')).resolves.toEqual({ id: 'l1' });
    expect(service.remove).toHaveBeenCalledWith('l1');
  });

  it('servis xatosi tarqaladi', async () => {
    const err = new Error('nf');
    service.findOne.mockRejectedValue(err);
    await expect(controller.findOne('x')).rejects.toBe(err);
    service.update.mockRejectedValue(err);
    await expect(controller.updateStatus('x', {} as any)).rejects.toBe(err);
  });

  it('metadata — guardlar va admin/receptionist roli', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LeadsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, LeadsController)).toEqual([
      'admin',
      'receptionist',
    ]);
  });
});
