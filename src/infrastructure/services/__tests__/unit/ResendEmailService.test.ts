/**
 * @jest-environment node
 */
import { ResendEmailService } from '../../ResendEmailService';

const RESET_LINK = 'https://remy-recipes.com/auth/reset-password?token=RAW_TOKEN_VALUE';

const message = {
  to: 'chef@example.com',
  subject: 'Reset your password',
  text: `Open this link: ${RESET_LINK}`,
  html: `<a href="${RESET_LINK}">Reset</a>`,
};

describe('ResendEmailService - Unit Tests', () => {
  const originalEnv = process.env;
  let fetchMock: jest.Mock;
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  const setNodeEnv = (value: string) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  };

  const allLogs = () =>
    [...errorSpy.mock.calls, ...infoSpy.mock.calls]
      .flat()
      .map((entry) => String(entry))
      .join('\n');

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('with an API key', () => {
    it('should POST the message to the Resend REST API', async () => {
      // Arrange
      const service = new ResendEmailService('re_test_key');

      // Act
      await service.send(message);

      // Assert
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        from: 'Remy <noreply@remy-recipes.com>',
        to: ['chef@example.com'],
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    });

    it('should authenticate with the key as a bearer token', async () => {
      const service = new ResendEmailService('re_test_key');

      await service.send(message);

      expect(fetchMock.mock.calls[0][1].headers).toEqual({
        Authorization: 'Bearer re_test_key',
        'Content-Type': 'application/json',
      });
    });

    it('should read the key from RESEND_API_KEY when none is injected', async () => {
      process.env.RESEND_API_KEY = 're_env_key';
      const service = new ResendEmailService();

      await service.send(message);

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer re_env_key');
    });

    it('should use EMAIL_FROM as the sender when it is set', async () => {
      process.env.EMAIL_FROM = 'Kitchen <hello@example.com>';
      const service = new ResendEmailService('re_test_key');

      await service.send(message);

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('Kitchen <hello@example.com>');
    });

    it('should resolve true when Resend accepts the message', async () => {
      const service = new ResendEmailService('re_test_key');

      await expect(service.send(message)).resolves.toBe(true);
    });

    it('should resolve false instead of throwing when Resend rejects the message', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 422 });
      const service = new ResendEmailService('re_test_key');

      await expect(service.send(message)).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('422'));
    });

    it('should resolve false instead of throwing when the network call fails', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      const service = new ResendEmailService('re_test_key');

      await expect(service.send(message)).resolves.toBe(false);
    });

    it('should resolve false when the failure is not an Error instance', async () => {
      fetchMock.mockRejectedValue('boom');
      const service = new ResendEmailService('re_test_key');

      await expect(service.send(message)).resolves.toBe(false);
    });

    it('should never log the link, the recipient or the key when delivery fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const service = new ResendEmailService('re_test_key');

      await service.send(message);

      expect(allLogs()).not.toContain('RAW_TOKEN_VALUE');
      expect(allLogs()).not.toContain('chef@example.com');
      expect(allLogs()).not.toContain('re_test_key');
    });
  });

  describe('without an API key', () => {
    it('should not call the provider', async () => {
      setNodeEnv('development');
      const service = new ResendEmailService();

      await service.send(message);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should resolve false instead of throwing', async () => {
      setNodeEnv('production');
      const service = new ResendEmailService();

      await expect(service.send(message)).resolves.toBe(false);
    });

    it('should resolve true in development, where the console preview is the delivery', async () => {
      setNodeEnv('development');
      const service = new ResendEmailService();

      await expect(service.send(message)).resolves.toBe(true);
    });

    it('should print the message with its link to the console in development', async () => {
      setNodeEnv('development');
      const service = new ResendEmailService();

      await service.send(message);

      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(RESET_LINK));
    });

    it('should log an error without the link or the token in production', async () => {
      setNodeEnv('production');
      const service = new ResendEmailService();

      await service.send(message);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY is not set'));
      expect(allLogs()).not.toContain('RAW_TOKEN_VALUE');
      expect(allLogs()).not.toContain(RESET_LINK);
    });

    it('should not print the message outside development', async () => {
      setNodeEnv('test');
      const service = new ResendEmailService();

      await service.send(message);

      expect(infoSpy).not.toHaveBeenCalled();
      expect(allLogs()).not.toContain('RAW_TOKEN_VALUE');
    });
  });
});
