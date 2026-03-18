import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_EXPIRY: Joi.string().optional(),
  JWT_REFRESH_SECRET: Joi.string().min(16).optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  JWT_REFRESH_COOKIE_NAME: Joi.string().default('refresh_token'),
  JWT_REFRESH_COOKIE_SECURE: Joi.boolean().default(false),
  JWT_REFRESH_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  JWT_REFRESH_FINGERPRINT_SALT: Joi.string().min(16).optional(),
  UPLOAD_DIR: Joi.string().default('./uploads'),
});
