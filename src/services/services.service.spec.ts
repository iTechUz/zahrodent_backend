import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesRepository } from './services.repository';

describe('ServicesService', () => {
  let service: ServicesService;
  let repo: jest.Mocked<
    Pick<
      ServicesRepository,
      | 'findAll'
      | 'findById'
      | 'create'
      | 'update'
      | 'delete'
      | 'count'
      | 'countCategories'
      | 'getAvgPrice'
      | 'getDetailedStats'
    >
  >;

  const svc = (partial: Record<string, unknown> = {}) =>
    ({
      id: 's1',
      name: 'Plomba',
      category: 'Terapiya',
      price: 300_000,
      duration: 45,
      description: null,
      ...partial,
    }) as any;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(svc()),
      update: jest.fn().mockResolvedValue(svc()),
      delete: jest.fn(),
      count: jest.fn(),
      countCategories: jest.fn(),
      getAvgPrice: jest.fn(),
      getDetailedStats: jest.fn(),
    };
    service = new ServicesService(repo as unknown as ServicesRepository);
  });

  describe('findAll', () => {
    it('default pagination', async () => {
      await service.findAll({});
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
    });

    it('category "all" e’tiborsiz', async () => {
      await service.findAll({ category: 'all', page: 2, limit: 3 });
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 6, take: 3 });
    });

    it('category va search (trim) birga', async () => {
      await service.findAll({ category: 'Terapiya', search: '  plom ' });
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        category: 'Terapiya',
        OR: [
          { name: { contains: 'plom', mode: 'insensitive' } },
          { category: { contains: 'plom', mode: 'insensitive' } },
        ],
      });
    });

    it('response — description null → undefined', async () => {
      repo.findAll.mockResolvedValue({
        data: [svc(), svc({ id: 's2', description: 'd' })],
        total: 2,
      });
      const out = await service.findAll({});
      expect(out).toEqual({
        data: [
          {
            id: 's1',
            name: 'Plomba',
            category: 'Terapiya',
            price: 300_000,
            duration: 45,
            description: undefined,
          },
          expect.objectContaining({ id: 's2', description: 'd' }),
        ],
        total: 2,
      });
    });
  });

  it('findOne — 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toThrow(
      new NotFoundException('Service not found'),
    );
  });

  it('findOne — topildi', async () => {
    repo.findById.mockResolvedValue(svc());
    await expect(service.findOne('s1')).resolves.toMatchObject({ id: 's1' });
  });

  it('create — faqat ruxsat etilgan maydonlar', async () => {
    const dto = {
      name: 'Plomba',
      category: 'Terapiya',
      price: 300_000,
      duration: 45,
      description: 'x',
    };
    await service.create(dto);
    expect(repo.create).toHaveBeenCalledWith(dto);
  });

  it('update — 404 bo‘lsa update yo‘q', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.update('x', { price: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update — qisman', async () => {
    repo.findById.mockResolvedValue(svc());
    await service.update('s1', { price: 350_000 });
    expect(repo.update).toHaveBeenCalledWith('s1', {
      name: undefined,
      category: undefined,
      price: 350_000,
      duration: undefined,
      description: undefined,
    });
  });

  it('remove — 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.remove('x')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('remove — id qaytaradi', async () => {
    repo.findById.mockResolvedValue(svc());
    await expect(service.remove('s1')).resolves.toEqual({ id: 's1' });
    expect(repo.delete).toHaveBeenCalledWith('s1');
  });

  it('getStats — agregatlar', async () => {
    repo.count.mockResolvedValue(12);
    repo.countCategories.mockResolvedValue(4);
    repo.getAvgPrice.mockResolvedValue(250_000);
    repo.getDetailedStats.mockResolvedValue([
      { serviceId: 's1', revenue: 1, patientCount: 1 },
    ]);
    await expect(service.getStats()).resolves.toEqual({
      totalCount: 12,
      categoriesCount: 4,
      avgPrice: 250_000,
      detailed: [{ serviceId: 's1', revenue: 1, patientCount: 1 }],
    });
  });
});
