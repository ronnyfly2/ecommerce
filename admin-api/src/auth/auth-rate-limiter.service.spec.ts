import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthRateLimiterService } from './auth-rate-limiter.service';

describe('AuthRateLimiterService', () => {
  let service: AuthRateLimiterService;

  beforeEach(() => {
    service = new AuthRateLimiterService();
  });

  it('allows requests within limit', () => {
    expect(() =>
      service.assertWithinLimit('login:1.1.1.1', 2, 60_000, 'Too many attempts'),
    ).not.toThrow();

    expect(() =>
      service.assertWithinLimit('login:1.1.1.1', 2, 60_000, 'Too many attempts'),
    ).not.toThrow();
  });

  it('throws 429 when limit is exceeded', () => {
    service.assertWithinLimit('login:1.1.1.1', 1, 60_000, 'Too many attempts');

    expect(() =>
      service.assertWithinLimit('login:1.1.1.1', 1, 60_000, 'Too many attempts'),
    ).toThrow(HttpException);

    try {
      service.assertWithinLimit('login:1.1.1.1', 1, 60_000, 'Too many attempts');
    } catch (error) {
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
