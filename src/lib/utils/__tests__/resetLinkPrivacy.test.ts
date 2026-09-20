import {
  RESET_PASSWORD_PATH,
  isResetPasswordPath,
  redactResetToken,
  scrubResetToken,
} from '../resetLinkPrivacy';

const RAW = 'q1w2e3-RAW_TOKEN_value';
const RESET_URL = `https://remy-recipes.com/auth/reset-password?token=${RAW}`;

describe('resetLinkPrivacy', () => {
  describe('redactResetToken', () => {
    it('should replace the token value in a full URL', () => {
      expect(redactResetToken(RESET_URL)).toBe(
        'https://remy-recipes.com/auth/reset-password?token=[redacted]'
      );
    });

    it('should keep the other query parameters and the fragment', () => {
      const result = redactResetToken(`/auth/reset-password?a=1&token=${RAW}&_rsc=abc#top`);

      expect(result).toBe('/auth/reset-password?a=1&token=[redacted]&_rsc=abc#top');
    });

    it('should redact a bare query string', () => {
      expect(redactResetToken(`token=${RAW}&a=1`)).toBe('token=[redacted]&a=1');
    });

    it('should redact a query string that starts with "?"', () => {
      expect(redactResetToken(`?token=${RAW}`)).toBe('?token=[redacted]');
    });

    it('should redact every occurrence in a longer text', () => {
      const result = redactResetToken(`from ${RESET_URL} to ${RESET_URL}`);

      expect(result).not.toContain(RAW);
    });

    it('should ignore the parameter name case', () => {
      expect(redactResetToken(`/x?Token=${RAW}`)).not.toContain(RAW);
    });

    it('should leave a parameter that merely ends in "token" alone', () => {
      expect(redactResetToken('/x?csrf_token=abc')).toBe('/x?csrf_token=abc');
    });

    it('should leave text without a token parameter untouched', () => {
      expect(redactResetToken('https://remy-recipes.com/recipe/42?page=2')).toBe(
        'https://remy-recipes.com/recipe/42?page=2'
      );
    });
  });

  describe('scrubResetToken', () => {
    it('should redact the token wherever a Sentry-like event keeps a URL', () => {
      // Arrange
      const event = {
        transaction: '/auth/reset-password',
        request: { url: RESET_URL, query_string: `token=${RAW}`, headers: { Referer: RESET_URL } },
        breadcrumbs: [{ category: 'navigation', data: { from: '/auth', to: RESET_URL } }],
        spans: [{ description: `GET ${RESET_URL}`, data: { 'url.query': `?token=${RAW}` } }],
        contexts: { trace: { data: { 'http.url': RESET_URL } } },
      };

      // Act
      const result = scrubResetToken(event);

      // Assert
      expect(JSON.stringify(result)).not.toContain(RAW);
      expect(result.request.url).toBe(
        'https://remy-recipes.com/auth/reset-password?token=[redacted]'
      );
      expect(result.transaction).toBe('/auth/reset-password');
    });

    it('should return the same object so SDK hooks can hand it straight back', () => {
      const event = { request: { url: RESET_URL } };

      expect(scrubResetToken(event)).toBe(event);
    });

    it('should accept a plain string', () => {
      expect(scrubResetToken(RESET_URL)).not.toContain(RAW);
    });

    it('should pass null, numbers and booleans through', () => {
      const event = { a: null, b: 3, c: true, d: undefined };

      expect(scrubResetToken(event)).toEqual({ a: null, b: 3, c: true, d: undefined });
      expect(scrubResetToken(null)).toBeNull();
    });

    it('should leave class instances untouched', () => {
      // Arrange - the SDK keeps live objects (scopes, spans) on the event
      class Live {
        url = RESET_URL;
      }
      const live = new Live();
      const when = new Date(0);

      // Act
      const result = scrubResetToken({ sdkProcessingMetadata: { live, when } });

      // Assert
      expect(result.sdkProcessingMetadata.live).toBe(live);
      expect(live.url).toBe(RESET_URL);
      expect(result.sdkProcessingMetadata.when).toBe(when);
    });

    it('should scrub objects created without a prototype', () => {
      const bare = Object.assign(Object.create(null), { url: RESET_URL });

      expect(scrubResetToken({ bare }).bare.url).not.toContain(RAW);
    });

    it('should survive circular references', () => {
      const event: { url: string; self?: unknown } = { url: RESET_URL };
      event.self = event;

      expect(() => scrubResetToken(event)).not.toThrow();
      expect(event.url).not.toContain(RAW);
    });

    it('should stop descending at a fixed depth', () => {
      // Arrange - 12 levels of nesting
      const root: Record<string, unknown> = {};
      let cursor = root;
      for (let i = 0; i < 12; i++) {
        cursor.next = {};
        cursor = cursor.next as Record<string, unknown>;
      }
      cursor.url = RESET_URL;

      // Act + Assert
      expect(() => scrubResetToken(root)).not.toThrow();
    });
  });

  describe('isResetPasswordPath', () => {
    it('should match the reset page', () => {
      expect(isResetPasswordPath('/auth/reset-password')).toBe(true);
    });

    it('should match paths under the reset page', () => {
      expect(isResetPasswordPath('/auth/reset-password/anything')).toBe(true);
    });

    it('should not match the other auth pages', () => {
      expect(isResetPasswordPath('/auth')).toBe(false);
      expect(isResetPasswordPath('/auth/forgot-password')).toBe(false);
      expect(isResetPasswordPath('/auth/reset-password-help')).toBe(false);
    });

    it('should point at the page the emailed link opens', () => {
      expect(RESET_PASSWORD_PATH).toBe('/auth/reset-password');
    });
  });
});
