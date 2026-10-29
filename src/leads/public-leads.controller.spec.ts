import { PublicLeadsController } from './public-leads.controller';

describe('PublicLeadsController', () => {
  it('creates a website lead, folding date + note into message', async () => {
    const leads = { create: jest.fn().mockResolvedValue({ id: 'l1' }) };
    const ctrl = new PublicLeadsController(leads as never);
    const r = await ctrl.create({
      name: ' Ali ',
      phone: '+998901234567',
      service: 'Implant',
      date: '2026-10-20',
      note: 'Kechqurun',
    });
    expect(r).toEqual({ ok: true });
    expect(leads.create).toHaveBeenCalledWith({
      name: 'Ali',
      phone: '+998901234567',
      service: 'Implant',
      doctor: undefined,
      preferredAt: '2026-10-20',
      message: 'Sana: 2026-10-20\nKechqurun',
      source: 'website',
    });
  });

  it('normalizes the phone to +998XXXXXXXXX and stores doctor + time', async () => {
    const leads = { create: jest.fn().mockResolvedValue({ id: 'l1' }) };
    const ctrl = new PublicLeadsController(leads as never);
    await ctrl.create({
      name: 'Ali',
      phone: '90 123-45-67',
      doctor: ' Dr. Karimov ',
      date: '2026-10-20',
      time: '10:30',
    });
    expect(leads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+998901234567',
        doctor: 'Dr. Karimov',
        preferredAt: '2026-10-20 10:30',
      }),
    );
  });

  it('rejects a non-Uzbek phone', async () => {
    const leads = { create: jest.fn() };
    const ctrl = new PublicLeadsController(leads as never);
    await expect(
      ctrl.create({ name: 'Ali', phone: '+1 555 123 4567' }),
    ).rejects.toThrow('Invalid phone');
    expect(leads.create).not.toHaveBeenCalled();
  });

  it('honeypot filled → ok but nothing stored', async () => {
    const leads = { create: jest.fn() };
    const ctrl = new PublicLeadsController(leads as never);
    const r = await ctrl.create({
      name: 'Bot',
      phone: '+998901234567',
      website: 'http://spam',
    });
    expect(r).toEqual({ ok: true });
    expect(leads.create).not.toHaveBeenCalled();
  });
});
