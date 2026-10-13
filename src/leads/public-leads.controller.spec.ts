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
      message: 'Sana: 2026-10-20\nKechqurun',
      source: 'website',
    });
  });
});
