import { existsSync, readFileSync } from 'node:fs';

/**
 * 加载 .env / .env.local。
 *
 * Prisma CLI 只会自动读取 `.env`，不会读取 `.env.local`；NestJS 的
 * `ConfigModule` 则会读这两个文件。为了让 `prisma` 命令与运行时看到同一份配置，
 * 这里在 CLI / 脚本入口手动补一遍（已存在的环境变量优先，不覆盖）。
 */
export const loadEnvFiles = (files: readonly string[] = ['.env.local', '.env']): void => {
  for (const file of files) {
    if (!existsSync(file)) {
      continue;
    }
    for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      const separator = line.indexOf('=');
      if (separator === -1) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        continue;
      }
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2');
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
};
