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
    ).rejects.toThrow("Telefon raqami noto'g'ri");
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

  it('forwards the form language to the lead', async () => {
    const leads = { create: jest.fn().mockResolvedValue({ id: 'l1' }) };
    const ctrl = new PublicLeadsController(leads as never);
    await ctrl.create({ name: 'Ali', phone: '+998901234567', lang: 'ru' });
    expect(leads.create).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'ru' }),
    );
  });

  it('PublicLeadDto — lang faqat uz/ru/en, xabarlar o‘zbekcha', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const { PublicLeadDto } = await import('./public-leads.controller');
    const bad = await validate(
      plainToInstance(PublicLeadDto, {
        name: 'A',
        phone: 'abc',
        lang: 'de',
        date: '1',
        time: '99',
      }),
    );
    const msgs = bad.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(msgs.join(' ')).not.toMatch(/Invalid|must be/);
    expect(bad.map((e) => e.property).sort()).toEqual([
      'date',
      'lang',
      'phone',
      'time',
    ]);
    const ok = await validate(
      plainToInstance(PublicLeadDto, {
        name: 'A',
        phone: '+998901234567',
        lang: 'uz',
      }),
    );
    expect(ok).toHaveLength(0);
  });
});
