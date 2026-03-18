import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitState = {
  attempts: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimiterService {
  private readonly state = new Map<string, RateLimitState>();

  assertWithinLimit(key: string, limit: number, windowMs: number, message: string) {
    const now = Date.now();
    const existing = this.state.get(key);

    if (!existing || now > existing.resetAt) {
      this.state.set(key, {
        attempts: 1,
        resetAt: now + windowMs,
      });
      return;
    }

    existing.attempts += 1;
    this.state.set(key, existing);

    if (existing.attempts > limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}