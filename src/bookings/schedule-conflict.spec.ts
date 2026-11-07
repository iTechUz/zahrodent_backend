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
});
