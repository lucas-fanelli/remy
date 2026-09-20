/**
 * @jest-environment node
 */
import {
  DEFAULT_SESSION_LIFETIME_SECONDS,
  getSessionLifetimeSeconds,
  getSessionRenewAfterSeconds,
  parseDurationSeconds,
} from '../session';

const DAY = 24 * 60 * 60;

describe('session lifetime', () => {
  const originalEnv = process.env;

  // Whatever the developer's own .env says about JWT_EXPIRES_IN must not leak in
  const setExpiresIn = (value: string | undefined) => {
    process.env = { ...originalEnv, JWT_EXPIRES_IN: value } as NodeJS.ProcessEnv;
  };

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseDurationSeconds', () => {
    it.each([
      ['30d', 30 * DAY],
      ['24h', DAY],
      ['60m', 3600],
      ['3600s', 3600],
      [' 7d ', 7 * DAY],
    ])('should parse %p into %p seconds', (value, expected) => {
      expect(parseDurationSeconds(value)).toBe(expected);
    });

    it.each([
      undefined,
      '',
      '30',
      'd',
      '30D',
      '1.5h',
      '-1d',
      '1w',
      '1d12h',
      'forever',
      '0d',
      '99999999999999999999d',
    ])('should reject %p', (value) => {
      expect(parseDurationSeconds(value)).toBeNull();
    });
  });

  describe('getSessionLifetimeSeconds', () => {
    it('should default to 30 days when JWT_EXPIRES_IN is missing', () => {
      setExpiresIn(undefined);

      expect(getSessionLifetimeSeconds()).toBe(30 * DAY);
      expect(DEFAULT_SESSION_LIFETIME_SECONDS).toBe(30 * DAY);
    });

    it('should default to 30 days when JWT_EXPIRES_IN is invalid', () => {
      setExpiresIn('one month');

      expect(getSessionLifetimeSeconds()).toBe(30 * DAY);
    });

    it('should follow a valid JWT_EXPIRES_IN', () => {
      setExpiresIn('7d');

      expect(getSessionLifetimeSeconds()).toBe(7 * DAY);
    });
  });

  describe('getSessionRenewAfterSeconds', () => {
    it('should renew after 24 hours with the default lifetime', () => {
      setExpiresIn(undefined);

      expect(getSessionRenewAfterSeconds()).toBe(DAY);
    });

    it('should renew at half the lifetime when the lifetime is too short to reach 24 hours', () => {
      setExpiresIn('24h');

      expect(getSessionRenewAfterSeconds()).toBe(12 * 60 * 60);
    });
  });
});
