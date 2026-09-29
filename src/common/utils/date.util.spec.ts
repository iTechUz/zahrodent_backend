import * as dateUtil from './date.util';
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

describe('Asia/Tashkent helpers', () => {
  const u = dateUtil;

  it('todayInTashkent — UTC 19:00 dan keyin ertangi kun', () => {
    expect(u.todayInTashkent(new Date('2026-06-17T18:59:59.999Z'))).toBe(
      '2026-06-17',
    );
    expect(u.todayInTashkent(new Date('2026-06-17T19:00:00.000Z'))).toBe(
      '2026-06-18',
    );
  });

  it('addDaysToDateOnly / addMonthsToMonthKey — chegaralar', () => {
    expect(u.addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01');
    expect(u.addDaysToDateOnly('2028-03-01', -1)).toBe('2028-02-29');
    expect(u.addMonthsToMonthKey('2026-01', -1)).toBe('2025-12');
    expect(u.addMonthsToMonthKey('2026-11', 3)).toBe('2027-02');
  });

  it('monthBoundsOf — oy boshi va oxiri', () => {
    expect(u.monthBoundsOf('2028-02-10')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('tashkentDayStart/End — timestamp chegaralari (UTC+5)', () => {
    expect(u.tashkentDayStart('2026-06-01').toISOString()).toBe(
      '2026-05-31T19:00:00.000Z',
    );
    expect(u.tashkentDayEnd('2026-06-01').toISOString()).toBe(
      '2026-06-01T18:59:59.999Z',
    );
    expect(u.tashkentInstantRange(undefined, '2026-06-01')).toEqual({
      lte: new Date('2026-06-01T18:59:59.999Z'),
    });
  });

  it('dateOnlyColumnRange — DATE ustun uchun UTC yarim tun', () => {
    expect(u.dateOnlyColumnRange('2026-06-01', '2026-06-30')).toEqual({
      gte: new Date('2026-06-01T00:00:00.000Z'),
      lte: new Date('2026-06-30T00:00:00.000Z'),
    });
    expect(u.dateOnlyColumnRange()).toEqual({});
  });

  it('relativeDateRange — today/week(Du–Ya)/month Toshkent bo‘yicha', () => {
    // Sunday 2026-06-21 20:00Z = Monday 2026-06-22 01:00 Toshkent
    const now = new Date('2026-06-21T20:00:00.000Z');
    expect(u.relativeDateRange('today', now)).toEqual({
      start: '2026-06-22',
      end: '2026-06-22',
    });
    expect(u.relativeDateRange('week', now)).toEqual({
      start: '2026-06-22',
      end: '2026-06-28',
    });
    expect(u.relativeDateRange('month', now)).toEqual({
      start: '2026-06-01',
      end: '2026-06-30',
    });
  });

  it('scheduleWeekday — 0 = dushanba … 6 = yakshanba', () => {
    expect(u.scheduleWeekday('2026-06-22')).toBe(0);
    expect(u.scheduleWeekday('2026-06-28')).toBe(6);
  });

  it('TIME_HH_MM_REGEX', () => {
    expect(u.TIME_HH_MM_REGEX.test('23:59')).toBe(true);
    expect(u.TIME_HH_MM_REGEX.test('24:00')).toBe(false);
  });
});
