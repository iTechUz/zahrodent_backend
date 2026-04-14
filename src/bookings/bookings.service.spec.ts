import { NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';

describe('BookingsService', () => {
  let service: BookingsService;
  let repo: jest.Mocked<
    Pick<
      BookingsRepository,
      'findAll' | 'findById' | 'create' | 'update' | 'delete'
    >
  >;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new BookingsService(repo as unknown as BookingsRepository);
  });

  it('findAll — patientId where ga tushadi', async () => {
    repo.findAll.mockResolvedValue([]);
    await service.findAll({ patientId: 'p1' });
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1' }),
      { take: undefined },
    );
  });

  it('findAll — status "all" bo‘lsa where.status yo‘q', async () => {
    repo.findAll.mockResolvedValue([]);
    await service.findAll({ status: 'all' });
    expect(repo.findAll).toHaveBeenCalledWith({}, { take: undefined });
  });

  it('findOne — topilmasa 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
