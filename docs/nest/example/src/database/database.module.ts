import { Global, Module } from '@nestjs/common';
import { PRISMA } from './database.constants.js';
import { db } from './prisma.js';

/**
 * 数据库模块：把 Prisma 8 客户端注册为全局 provider。
 * 客户端是惰性的 —— 应用启动时不会连接数据库，第一次查询才建立连接。
 */
@Global()
@Module({
  providers: [{ provide: PRISMA, useValue: db }],
  exports: [PRISMA],
})
export class DatabaseModule {}
