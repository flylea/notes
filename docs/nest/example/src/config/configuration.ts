import { envSchema } from './env.validation.js';

/**
 * 把校验后的环境变量整理成有层级的应用配置。
 * 使用 ConfigService.get('redis.url') 这样的路径读取。
 */
export const configuration = () => {
  const env = envSchema.parse(process.env);

  return {
    environment: env.NODE_ENV,
    port: env.PORT,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: {
      url: env.DATABASE_URL,
      directUrl: env.DIRECT_URL ?? env.DATABASE_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;
