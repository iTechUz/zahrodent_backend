import { NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import type { AuthUserView } from '../auth/auth.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let repo: jest.Mocked<
    Pick<
      BookingsRepository,
      'findAll' | 'findById' | 'create' | 'update' | 'delete'
    >
  >;
  const user: AuthUserView = {
    id: 'u1',
    name: 'Test',
    email: 'test@example.com',
    role: 'receptionist',
  };

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
    repo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    await service.findAll({ patientId: 'p1', limit: 10, page: 0 }, user);
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1' }),
      { skip: 0, take: 10 },
    );
  });

  it('findAll — status "all" bo‘lsa where.status yo‘q', async () => {
    repo.findAll.mockResolvedValue({ data: [], total: 0 } as any);
    await service.findAll({ status: 'all', limit: 10, page: 0 }, user);
    expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10 });
  });

  it('findOne — topilmasa 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('x', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
