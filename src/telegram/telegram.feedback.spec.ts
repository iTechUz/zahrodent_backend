import { TelegramService } from './telegram.service';

describe('TelegramService.saveFeedback', () => {
  let prisma: any;
  let svc: TelegramService;
  const booking = (o: object = {}) => ({
    status: 'completed',
    feedbackRating: null,
    patient: { telegramChatId: '555' },
    ...o,
  });

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    svc = new TelegramService({} as never, {} as never, {} as never, prisma);
  });

  it('own chat + completed → saved', async () => {
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('saved');
    expect(prisma.booking.updateMany.mock.calls[0][0].data.feedbackRating).toBe(
      5,
    );
  });

  it('someone else’s chat → denied, nothing written', async () => {
    await expect(svc.saveFeedback(999, 'b1', 5)).resolves.toBe('denied');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('not completed / unknown / bad rating → denied', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'pending' }));
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('denied');
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('denied');
    await expect(svc.saveFeedback(555, 'b1', 9)).resolves.toBe('denied');
  });

  it('already rated → already', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ feedbackRating: 4 }));
    await expect(svc.saveFeedback(555, 'b1', 5)).resolves.toBe('already');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });
});
