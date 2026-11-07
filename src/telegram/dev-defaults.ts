/**
 * DEV TEST DEFAULTS for Telegram. Used ONLY when the matching env variable is
 * unset AND NODE_ENV is not 'production'. Env variables always win, and prod
 * (NODE_ENV=production) ignores these constants entirely. Owner asked for these to live in the repo on dev
 * for message testing — remove this file once testing is done and rotate the
 * token in @BotFather (/revoke) because it is in git history.
 */
export const DEV_TELEGRAM_BOT_TOKEN =
  '9055073285:AAE1i1KG4wHfc5y7XPHAwXgHCdZnbyqttN0';

/** Staff test group chat id (negative number). Fill in once known. */
// "Zahro CRM" test group
export const DEV_TELEGRAM_CHAT_ID = '-1004348351583';

/**
 * Dev only: never when NODE_ENV=production (the main/prod deploy) and never in
 * Jest (NODE_ENV=test, tests must see "no token / no chat" as unset).
 */
const useDevDefaults = () =>
  process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

export function telegramBotToken(): string | undefined {
  return (
    process.env.TELEGRAM_BOT_TOKEN ||
    (useDevDefaults() ? DEV_TELEGRAM_BOT_TOKEN : '') ||
    undefined
  );
}

export function leadsChatId(): string | undefined {
  return (
    process.env.TELEGRAM_LEADS_CHAT_ID?.trim() ||
    (useDevDefaults() ? DEV_TELEGRAM_CHAT_ID : '') ||
    undefined
  );
}

export function statusChatId(): string | undefined {
  return process.env.TELEGRAM_STATUS_CHAT_ID?.trim() || leadsChatId();
}
