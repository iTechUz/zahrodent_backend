import {
  bookingsTopicId,
  leadsChatId,
  statusChatId,
  telegramBotToken,
} from './dev-defaults';

describe('dev-defaults (faqat env)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('dev: env yo‘q bo‘lsa token ham, chat ham undefined (repoda default yo‘q)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_LEADS_CHAT_ID;
    delete process.env.TELEGRAM_STATUS_CHAT_ID;
    expect(telegramBotToken()).toBeUndefined();
    expect(leadsChatId()).toBeUndefined();
    expect(statusChatId()).toBeUndefined();
  });

  it('env qiymatlari trim qilinib qaytariladi', () => {
    process.env.NODE_ENV = 'development';
    process.env.TELEGRAM_BOT_TOKEN = ' env-token ';
    process.env.TELEGRAM_LEADS_CHAT_ID = ' -100999 ';
    process.env.TELEGRAM_STATUS_CHAT_ID = ' -100123 ';
    expect(telegramBotToken()).toBe('env-token');
    expect(leadsChatId()).toBe('-100999');
    expect(statusChatId()).toBe('-100123');
  });

  it('statusChatId bo‘sh bo‘lsa leadsChatId ga tushadi', () => {
    delete process.env.TELEGRAM_STATUS_CHAT_ID;
    process.env.TELEGRAM_LEADS_CHAT_ID = '-100999';
    expect(statusChatId()).toBe('-100999');
  });

  it('bookingsTopicId: faqat musbat butun son', () => {
    process.env.TELEGRAM_BOOKINGS_TOPIC_ID = '32';
    expect(bookingsTopicId()).toBe(32);
    process.env.TELEGRAM_BOOKINGS_TOPIC_ID = 'abc';
    expect(bookingsTopicId()).toBeUndefined();
    process.env.TELEGRAM_BOOKINGS_TOPIC_ID = '0';
    expect(bookingsTopicId()).toBeUndefined();
  });
});
