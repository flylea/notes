import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';
import { loadEnvFiles } from './src/config/load-env.js';

// Prisma CLI 只自动读 .env；这里补齐 .env.local，保证与 NestJS 运行时一致。
loadEnvFiles();

const config: ReturnType<typeof definePrismaConfig> = definePrismaConfig({
  orm: definePostgresConfig({
    contract: 'prisma/contract.prisma',
    output: 'src/generated/prisma8',
    db: {
      connection: process.env.DATABASE_URL ?? '',
    },
    migrations: {
      dir: 'prisma/migrations',
    },
  }),
});

export default config;
