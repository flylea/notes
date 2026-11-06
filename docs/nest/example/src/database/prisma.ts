import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';

import type { Contract } from '../generated/prisma8/contract.js';
import contractJson from '../generated/prisma8/contract.json' with { type: 'json' };

/**
 * 由 `prisma/contract.prisma` 编译出的契约（`pnpm db:emit` 生成）。
 * 生成物不要手改；契约改动后重新 emit 即可。
 */
export const contract = contractFromJson<Contract>(contractJson);

/**
 * 创建一个 Prisma 8 客户端。
 * `postgres()` 只做惰性初始化，不会在模块 import 阶段建立连接，
 * 因此没有数据库时 `pnpm build` / `pnpm typecheck` 依然可以通过。
 */
export const createDatabase = (url: string) => postgres({ contract, url });

export type Database = ReturnType<typeof createDatabase>;

let singleton: Database | null = null;

/**
 * 进程内单例。第一次访问数据库时才读取 DATABASE_URL 并创建客户端。
 */
export const getDb = (): Database => {
  if (!singleton) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        '缺少 DATABASE_URL 环境变量：请先 cp .env.example .env，并填写 PostgreSQL 连接串',
      );
    }
    singleton = createDatabase(url);
  }
  return singleton;
};

/**
 * 惰性访问器：`db.orm.public.User` 这种用法在第一次取属性时才创建客户端。
 * NestJS 里更推荐注入 `PRISMA` token（见 database.module.ts），
 * 这里主要方便脚本与非 DI 场景。
 */
export const db: Database = new Proxy({} as Database, {
  get: (_target, property) => {
    const client = getDb();
    const value = Reflect.get(client as object, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
