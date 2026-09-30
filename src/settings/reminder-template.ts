/** Placeholders supported in reminder templates. */
export const REMINDER_PLACEHOLDERS = [
  'name',
  'date',
  'time',
  'doctor',
  'clinic',
] as const;

export type ReminderPlaceholder = (typeof REMINDER_PLACEHOLDERS)[number];
export type ReminderVars = Record<ReminderPlaceholder, string>;

export const DEFAULT_REMINDER_TEMPLATE =
  'Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental';

/**
 * Replaces `{name}`, `{date}`, `{time}`, `{doctor}`, `{clinic}`. Unknown
 * `{...}` tokens are left untouched; values are inserted literally.
 */
export function renderReminderTemplate(
  template: string,
  vars: ReminderVars,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    (REMINDER_PLACEHOLDERS as readonly string[]).includes(key)
      ? vars[key as ReminderPlaceholder]
      : whole,
  );
}

/** `YYYY-MM-DD` → `DD.MM.YYYY` (the format patients read in messages). */
export function formatReminderDate(dateOnly: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : dateOnly;
}
