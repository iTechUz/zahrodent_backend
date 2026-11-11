import { scheduleViolation } from './schedule-conflict';

const week = (isWorking: boolean) =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    startTime: '09:00',
    endTime: '18:00',
    isWorking: day === 2 ? isWorking : true,
  }));

describe('scheduleViolation', () => {
  // 2026-06-10 is a Wednesday (index 2)
  it('fits → null', () => {
    expect(
      scheduleViolation(
        { schedule: week(true), daysOff: [] },
        '2026-06-10',
        '10:00',
        30,
      ),
    ).toBeNull();
  });

  it('day off, non-working weekday, outside hours', () => {
    expect(
      scheduleViolation(
        { schedule: null, daysOff: ['2026-06-10'] },
        '2026-06-10',
        '10:00',
        30,
      ),
    ).toContain('dam oladi');
    expect(
      scheduleViolation(
        { schedule: week(false), daysOff: [] },
        '2026-06-10',
        '10:00',
        30,
      ),
    ).toContain('ishlamaydi');
    expect(
      scheduleViolation(
        { schedule: week(true), daysOff: [] },
        '2026-06-10',
        '17:45',
        30,
      ),
    ).toContain('09:00–18:00');
  });

  it('untouched schedule (nobody works) is ignored', () => {
    const none = week(false).map((s) => ({ ...s, isWorking: false }));
    expect(
      scheduleViolation(
        { schedule: none, daysOff: null },
        '2026-06-10',
        '03:00',
        30,
      ),
    ).toBeNull();
  });

  it('jadval berilgan, lekin hafta kuni yo‘q — ishlamaydi deb hisoblanadi', () => {
    // faqat dushanba (0) bor; 2026-06-10 chorshanba (2)
    const monOnly = [
      { day: 0, startTime: '09:00', endTime: '18:00', isWorking: true },
    ];
    expect(
      scheduleViolation(
        { schedule: monOnly, daysOff: [] },
        '2026-06-10',
        '10:00',
        30,
      ),
    ).toContain('ishlamaydi');
    // 2026-06-08 dushanba — o‘tadi
    expect(
      scheduleViolation(
        { schedule: monOnly, daysOff: [] },
        '2026-06-08',
        '10:00',
        30,
      ),
    ).toBeNull();
  });

  describe('tushlik tanaffusi', () => {
    const withBreak = (extra: Record<string, unknown> = {}) => [
      {
        day: 2,
        startTime: '09:00',
        endTime: '18:00',
        isWorking: true,
        breakStart: '13:00',
        breakEnd: '14:00',
        ...extra,
      },
    ];
    const check = (schedule: unknown, time: string, duration = 30) =>
      scheduleViolation(
        { schedule, daysOff: [] },
        '2026-06-10',
        time,
        duration,
      );

    it('tanaffusga to‘liq tushsa yoki kesishsa — rad', () => {
      expect(check(withBreak(), '13:00')).toContain('tanaffus');
      expect(check(withBreak(), '13:30')).toContain('13:00–14:00');
      expect(check(withBreak(), '12:45')).toContain('tanaffus'); // 12:45–13:15
    });

    it('tanaffusdan oldin tugasa / keyin boshlansa — o‘tadi', () => {
      expect(check(withBreak(), '12:30')).toBeNull(); // 12:30–13:00
      expect(check(withBreak(), '14:00')).toBeNull();
    });

    it('eski jadval (tanaffussiz) va bo‘sh/yarim tanaffus — o‘zgarishsiz', () => {
      expect(
        check(
          withBreak({ breakStart: undefined, breakEnd: undefined }),
          '13:00',
        ),
      ).toBeNull();
      expect(check(withBreak({ breakEnd: null }), '13:00')).toBeNull();
    });

    it('HH:mm:ss formatidagi tanaffus ham ishlaydi', () => {
      expect(
        check(
          withBreak({ breakStart: '13:00:00', breakEnd: '14:00:00' }),
          '13:15',
        ),
      ).toContain('tanaffus');
    });
  });
});
