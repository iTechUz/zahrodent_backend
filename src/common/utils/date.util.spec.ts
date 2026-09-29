import {
  endOfUTCDayInclusive,
  parseDateOnlyToUTC,
  startOfUTCDay,
  toDateOnlyString,
} from './date.util';

describe('date.util', () => {
  describe('toDateOnlyString', () => {
    it('UTC qismlaridan YYYY-MM-DD yasaydi', () => {
      expect(toDateOnlyString(new Date('2026-06-01T00:00:00.000Z'))).toBe(
        '2026-06-01',
      );
    });

    it('oy va kunni 2 xonagacha to‘ldiradi', () => {
      expect(toDateOnlyString(new Date(Date.UTC(2026, 0, 5)))).toBe(
        '2026-01-05',
      );
    });

    it('kun oxiridagi UTC vaqt keyingi kunga siljimaydi', () => {
      expect(toDateOnlyString(new Date('2026-12-31T23:59:59.999Z'))).toBe(
        '2026-12-31',
      );
    });
  });

  describe('parseDateOnlyToUTC', () => {
    it('YYYY-MM-DD ni UTC yarim tunga aylantiradi', () => {
      expect(parseDateOnlyToUTC('2026-06-01').toISOString()).toBe(
        '2026-06-01T00:00:00.000Z',
      );
    });

    it('boshqa formatlarda Date parsingga tushadi', () => {
      expect(parseDateOnlyToUTC('2026-06-01T10:30:00.000Z').toISOString()).toBe(
        '2026-06-01T10:30:00.000Z',
      );
    });

    it('noto‘g‘ri qator — Invalid Date', () => {
      expect(Number.isNaN(parseDateOnlyToUTC('not-a-date').getTime())).toBe(
        true,
      );
    });

    it('toDateOnlyString bilan qaytma-qaytish barqaror', () => {
      expect(toDateOnlyString(parseDateOnlyToUTC('2024-02-29'))).toBe(
        '2024-02-29',
      );
    });
  });

  describe('startOfUTCDay / endOfUTCDayInclusive', () => {
    const d = new Date('2026-06-15T13:45:12.345Z');

    it('startOfUTCDay — 00:00:00.000Z', () => {
      expect(startOfUTCDay(d).toISOString()).toBe('2026-06-15T00:00:00.000Z');
    });

    it('endOfUTCDayInclusive — 23:59:59.999Z', () => {
      expect(endOfUTCDayInclusive(d).toISOString()).toBe(
        '2026-06-15T23:59:59.999Z',
      );
    });

    it('kiruvchi Date o‘zgartirilmaydi', () => {
      const copy = new Date(d);
      startOfUTCDay(d);
      endOfUTCDayInclusive(d);
      expect(d.getTime()).toBe(copy.getTime());
    });
  });
});
