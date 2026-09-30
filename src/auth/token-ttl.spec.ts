import {
  getAccessTokenTtlSeconds,
  getRefreshTokenTtlDays,
  parseDurationSeconds,
} from './token-ttl';

describe('token-ttl', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it.each([
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604800],
    ['2w', 1209600],
    ['900', 900],
    ['30s', 30],
    [' 10M ', 600],
  ])('parseDurationSeconds(%p) = %p', (raw, out) => {
    expect(parseDurationSeconds(raw)).toBe(out);
  });

  it.each([undefined, '', 'abc', '0', '0m', '-5m', '1.5h', '10y'])(
    'parseDurationSeconds(%p) = null',
    (raw) => {
      expect(parseDurationSeconds(raw)).toBeNull();
    },
  );

  it('access TTL — standart 15m, env bilan, noto‘g‘ri → standart', () => {
    delete process.env.JWT_EXPIRES_IN;
    expect(getAccessTokenTtlSeconds()).toBe(900);
    process.env.JWT_EXPIRES_IN = '1h';
    expect(getAccessTokenTtlSeconds()).toBe(3600);
    process.env.JWT_EXPIRES_IN = 'forever';
    expect(getAccessTokenTtlSeconds()).toBe(900);
  });

  it('refresh TTL — standart 30, 1..365 oralig‘i', () => {
    delete process.env.REFRESH_TOKEN_TTL_DAYS;
    expect(getRefreshTokenTtlDays()).toBe(30);
    process.env.REFRESH_TOKEN_TTL_DAYS = '7';
    expect(getRefreshTokenTtlDays()).toBe(7);
    process.env.REFRESH_TOKEN_TTL_DAYS = '0';
    expect(getRefreshTokenTtlDays()).toBe(30);
    process.env.REFRESH_TOKEN_TTL_DAYS = 'x';
    expect(getRefreshTokenTtlDays()).toBe(30);
    process.env.REFRESH_TOKEN_TTL_DAYS = '9999';
    expect(getRefreshTokenTtlDays()).toBe(365);
  });
});
