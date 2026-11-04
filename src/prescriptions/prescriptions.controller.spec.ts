import 'reflect-metadata';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('PrescriptionsController', () => {
  let controller: PrescriptionsController;
  let service: Record<
    'findAll' | 'pharmacySearch' | 'dispense' | 'findOne' | 'create' | 'cancel',
    jest.Mock
  >;
  const user = { id: 'u1', role: 'doctor' } as any;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      pharmacySearch: jest.fn(),
      dispense: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
    };
    controller = new PrescriptionsController(
      service as unknown as PrescriptionsService,
    );
  });

  it('findAll — query va user', async () => {
    const query = { status: 'issued' } as any;
    service.findAll.mockResolvedValue({ data: [], total: 0 });
    await expect(controller.findAll(query, user)).resolves.toEqual({
      data: [],
      total: 0,
    });
    expect(service.findAll).toHaveBeenCalledWith(query, user);
  });

  it('pharmacySearch — faqat query.q uzatiladi', async () => {
    service.pharmacySearch.mockResolvedValue([{ id: 'r1' }]);
    await expect(
      controller.pharmacySearch({ q: 'K7M2X9QD' } as any),
    ).resolves.toEqual([{ id: 'r1' }]);
    expect(service.pharmacySearch).toHaveBeenCalledWith('K7M2X9QD');
  });

  it('dispense — id va user', async () => {
    service.dispense.mockResolvedValue({ id: 'r1', status: 'dispensed' });
    await expect(controller.dispense('r1', user)).resolves.toEqual({
      id: 'r1',
      status: 'dispensed',
    });
    expect(service.dispense).toHaveBeenCalledWith('r1', user);
  });

  it('findOne — id va user', async () => {
    service.findOne.mockResolvedValue({ id: 'r1' });
    await expect(controller.findOne('r1', user)).resolves.toEqual({
      id: 'r1',
    });
    expect(service.findOne).toHaveBeenCalledWith('r1', user);
  });

  it('create — dto va user', async () => {
    const dto = { patientId: 'p1', items: [] } as any;
    service.create.mockResolvedValue({ id: 'r1' });
    await expect(controller.create(dto, user)).resolves.toEqual({ id: 'r1' });
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('cancel — id va user', async () => {
    service.cancel.mockResolvedValue({ id: 'r1', status: 'cancelled' });
    await expect(controller.cancel('r1', user)).resolves.toEqual({
      id: 'r1',
      status: 'cancelled',
    });
    expect(service.cancel).toHaveBeenCalledWith('r1', user);
  });

  it('xatolar tarqaladi', async () => {
    service.dispense.mockRejectedValue(new Error('already'));
    await expect(controller.dispense('r1', user)).rejects.toThrow('already');
    service.cancel.mockRejectedValue(new Error('nope'));
    await expect(controller.cancel('r1', user)).rejects.toThrow('nope');
  });

  describe('metadata', () => {
    const roles = (m: keyof PrescriptionsController) =>
      Reflect.getMetadata(ROLES_KEY, PrescriptionsController.prototype[m]);

    it('guardlar va klass rollari', () => {
      expect(
        Reflect.getMetadata('__guards__', PrescriptionsController),
      ).toEqual([JwtAuthGuard, RolesGuard]);
      expect(Reflect.getMetadata(ROLES_KEY, PrescriptionsController)).toEqual([
        'admin',
        'doctor',
        'receptionist',
      ]);
    });

    it.each(['pharmacySearch', 'dispense'] as const)(
      '%s — admin va pharmacist',
      (m) => {
        expect(roles(m)).toEqual(['admin', 'pharmacist']);
      },
    );

    it.each(['create', 'cancel'] as const)('%s — admin va doctor', (m) => {
      expect(roles(m)).toEqual(['admin', 'doctor']);
    });

    it.each(['findAll', 'findOne'] as const)('%s — klass rollari', (m) => {
      expect(roles(m)).toBeUndefined();
    });
  });
});
