import { z } from 'zod';

/**
 * 允许空字符串（例如 `REDIS_URL=`）表示“未配置”。
 */
const optionalUrl = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.url().optional(),
);

/**
 * PostgreSQL 连接串：Prisma 8 运行时唯一的数据源配置。
 * 使用 DIRECT_URL 可以区分「连接池地址（运行时）」与「直连地址（迁移 / seed）」。
 */
const databaseUrl = z
  .string()
  .min(1, 'DATABASE_URL 不能为空')
  .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
    message: 'DATABASE_URL 必须是 postgres:// 或 postgresql:// 开头的连接串',
  });

/**
 * 环境变量 schema —— 应用配置的唯一事实来源。
 *
 * - 除 DATABASE_URL 外都有安全的开发默认值，保证 `pnpm build` / `pnpm typecheck`
 *   在没有 .env 时也能通过。
 * - 生产环境请务必覆盖 JWT_*_SECRET。
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173,http://localhost:3000'),

  // PostgreSQL 17：运行时连 DATABASE_URL，迁移 / seed 优先用 DIRECT_URL。
  DATABASE_URL: databaseUrl,
  DIRECT_URL: optionalUrl,

  // Redis 可选：不配置时统计模块自动降级为直接查库。
  REDIS_URL: optionalUrl,

  // JWT 双 token。
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // 限流。
  THROTTLE_TTL: z.coerce.number().int().min(1000).default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 传给 ConfigModule.forRoot({ validate }) 的校验函数。
 * 校验失败时抛出包含字段名的错误，阻止应用带着错误配置启动。
 */
export const validateEnv = (config: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`环境变量校验失败: ${details}`);
  }
  return result.data;
};
