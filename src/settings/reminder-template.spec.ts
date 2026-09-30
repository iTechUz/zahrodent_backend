import {
  DEFAULT_REMINDER_TEMPLATE,
  formatReminderDate,
  renderReminderTemplate,
} from './reminder-template';

describe('reminder-template', () => {
  const vars = {
    name: 'Ali Valiyev',
    date: '01.07.2026',
    time: '10:30',
    doctor: 'Aziz Karimov',
    clinic: 'Zahro Dental',
  };

  it('standart shablon', () => {
    expect(renderReminderTemplate(DEFAULT_REMINDER_TEMPLATE, vars)).toBe(
      'Hurmatli Ali Valiyev, 01.07.2026 kuni soat 10:30 da Aziz Karimov qabuliga yozilgansiz. Zahro Dental',
    );
  });

  it('barcha placeholderlar, takrorlangan ham; noma’lumlari o‘zgarmaydi', () => {
    expect(
      renderReminderTemplate(
        '{clinic}: {name} {name} {date} {time} {doctor} {unknown} {}',
        vars,
      ),
    ).toBe(
      'Zahro Dental: Ali Valiyev Ali Valiyev 01.07.2026 10:30 Aziz Karimov {unknown} {}',
    );
  });

  it('qiymatdagi $ yoki {..} qayta ishlanmaydi', () => {
    expect(
      renderReminderTemplate('{name}/{doctor}', {
        ...vars,
        name: '$& {doctor} $1',
      }),
    ).toBe('$& {doctor} $1/Aziz Karimov');
  });

  it('formatReminderDate', () => {
    expect(formatReminderDate('2026-07-01')).toBe('01.07.2026');
    expect(formatReminderDate('bad')).toBe('bad');
  });
});
