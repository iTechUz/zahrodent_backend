/**
 * Telegram env yordamchilari. Qiymatlar FAQAT env'dan o'qiladi (dev uchun ham):
 * repoda hech qanday token yoki chat id saqlanmaydi. Lokal sinov uchun `.env` ga
 * o'zingizning test botingiz tokenini va guruh id'sini qo'ying.
 * (Fayl nomi tarixiy sabab bilan saqlangan — import'lar buzilmasin.)
 */
export function telegramBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

export function leadsChatId(): string | undefined {
  return process.env.TELEGRAM_LEADS_CHAT_ID?.trim() || undefined;
}

export function statusChatId(): string | undefined {
  return process.env.TELEGRAM_STATUS_CHAT_ID?.trim() || leadsChatId();
}

/**
 * Forum topic (`message_thread_id`) of the staff group where booking messages go
 * (status changes, new/moved/deleted bookings, reschedule requests, low ratings).
 * Unset or not a positive integer → those messages go to the group's General chat.
 */
export function bookingsTopicId(): number | undefined {
  const raw = process.env.TELEGRAM_BOOKINGS_TOPIC_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return id > 0 ? id : undefined;
}
